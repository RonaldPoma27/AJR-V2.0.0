"""Real in-process FastAPI tests with isolated SQLite persistence; no PostgreSQL locking claims."""
import io, os, unittest
from datetime import date, timedelta
os.environ.setdefault('DATABASE_URL','sqlite+aiosqlite:///:memory:')
os.environ.setdefault('SECRET_KEY','local-test-only-secret-key-000000000000000')
import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.api.routers.agile import router
from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.security import create_access_token
from app.models import Base, User, UserRole
from app.core import audit
@compiles(JSONB,'sqlite')
def jsonb(element,compiler,**kw): return 'JSON'
class AgileAPITests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.engine=create_async_engine('sqlite+aiosqlite:///:memory:')
  @event.listens_for(self.engine.sync_engine,'connect')
  def fk(conn,_): conn.execute('PRAGMA foreign_keys=ON')
  async with self.engine.begin() as conn: await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[t for t in Base.metadata.sorted_tables if t.name in {'users','audit_logs'} or t.name.startswith('agile_')]))
  self.sessions=async_sessionmaker(self.engine,expire_on_commit=False)
  async with self.sessions() as db:
   users=[User(email=f'{n}@example.com',hashed_password='inert',role=r) for n,r in [('admin',UserRole.ADMIN),('sm',UserRole.TECHNICIAN),('po',UserRole.TECHNICIAN),('dev',UserRole.TECHNICIAN),('observer',UserRole.TECHNICIAN),('outsider',UserRole.TECHNICIAN),('client',UserRole.USER)]]
   db.add_all(users);await db.commit();self.ids={u.email.split('@')[0]:u.id for u in users}
  app=FastAPI();app.include_router(router,prefix='/api')
  @app.exception_handler(AppError)
  async def error(request,exc): return JSONResponse(status_code=exc.status_code,content={'detail':exc.detail})
  async def session():
   async with self.sessions() as db: yield db
  app.dependency_overrides[get_db]=session
  self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test')
  self.project=(await self.call('POST','/projects',json={'key':'TEST','name':'Test project'})).json();self.path=f"/projects/{self.project['id']}"
  for n,r in [('sm','SCRUM_MASTER'),('po','PRODUCT_OWNER'),('dev','DEVELOPER'),('observer','OBSERVER')]:
   res=await self.call('POST',self.path+'/members',json={'user_id':self.ids[n],'role':r});self.assertEqual(res.status_code,201,res.text)
 async def asyncTearDown(self): await self.client.aclose();await self.engine.dispose()
 async def call(self,method,path,actor='admin',**kw): return await self.client.request(method,'/api/agile'+path,headers={'Authorization':'Bearer '+create_access_token(self.ids[actor])},**kw)
 async def item(self,**kw):
  r=await self.call('POST',self.path+'/items',json={'title':'Story',**kw});self.assertEqual(r.status_code,201,r.text);return r.json()
 async def sprint(self,start='2026-10-29',name='Sprint 1'):
  r=await self.call('POST',self.path+'/sprints',json={'name':name,'start_date':start,'end_date':(date.fromisoformat(start)+timedelta(days=13)).isoformat()});self.assertEqual(r.status_code,201,r.text);return r.json()
 async def test_roles_and_isolation(self):
  for actor,code in [('sm',200),('po',200),('dev',200),('observer',200),('outsider',404),('client',403)]:
   r=await self.call('GET',self.path+'/items',actor);self.assertEqual(r.status_code,code,r.text)
  for actor,code in [('sm',201),('po',201),('dev',403),('observer',403),('outsider',404)]:
   r=await self.call('POST',self.path+'/items',actor,json={'title':'Role test'});self.assertEqual(r.status_code,code,r.text)
  item=await self.item(assignee_id=self.ids['dev'])
  for actor,payload,code in [('dev',{'status':'IN_PROGRESS'},200),('dev',{'priority':'URGENT'},403),('observer',{'status':'DONE'},403)]:
   r=await self.call('PATCH',self.path+f"/items/{item['id']}",actor,json=payload);self.assertEqual(r.status_code,code,r.text)
  a=await self.item(title='Unassigned');r=await self.call('PATCH',self.path+f"/items/{a['id']}",'dev',json={'status':'DONE'});self.assertEqual(r.status_code,403)
  other=(await self.call('POST','/projects',json={'key':'OTHER','name':'Other project'})).json()
  r=await self.call('PATCH',f"/projects/{other['id']}/items/{item['id']}",json={'status':'DONE'});self.assertEqual(r.status_code,404)
 async def test_epics_null_and_archived(self):
  e=await self.item(title='Epic',item_type='EPIC');a=await self.item(epic_id=e['id'])
  for item,payload,code in [(e,{'item_type':'TASK'},409),(a,{'epic_id':a['id']},422),(a,{'status':None},422)]:
   r=await self.call('PATCH',self.path+f"/items/{item['id']}",json=payload);self.assertEqual(r.status_code,code,r.text)
  await self.call('PATCH',self.path,json={'status':'ARCHIVED'})
  r=await self.call('POST',self.path+f"/items/{a['id']}/comments",'sm',json={'content':'Forbidden'});self.assertEqual(r.status_code,409)
 async def test_close_sprint_preserves_identity_and_history(self):
  s=await self.sprint();n=await self.sprint('2026-11-12','Sprint 2')
  done=await self.item(title='Done',status='DONE',sprint_id=s['id']);pending=await self.item(title='Pending',sprint_id=s['id']);blocked=await self.item(title='Blocked',status='BLOCKED',sprint_id=s['id'])
  r=await self.call('POST',self.path+f"/sprints/{s['id']}/start");self.assertEqual(r.status_code,200,r.text)
  r=await self.call('POST',self.path+f"/sprints/{n['id']}/start");self.assertEqual(r.status_code,409)
  payload={'carry_over':True,'next_sprint_id':n['id'],'item_ids':[pending['id']]}
  r=await self.call('POST',self.path+f"/sprints/{s['id']}/complete",json=payload);self.assertEqual(r.status_code,200,r.text);self.assertEqual([r.json()[k] for k in ['completed_items','carried_over','returned_to_backlog']],[1,1,1])
  r=await self.call('POST',self.path+f"/sprints/{s['id']}/complete",json=payload);self.assertEqual(r.status_code,409)
  items=(await self.call('GET',self.path+'/items')).json();self.assertEqual({i['id'] for i in items},{done['id'],pending['id'],blocked['id']})
  self.assertEqual(next(i for i in items if i['id']==pending['id'])['sprint_id'],n['id'])
  hist=(await self.call('GET',self.path+f"/items/{pending['id']}/history")).json();self.assertTrue(any(h['old_value']==str(s['id']) and h['new_value']==str(n['id']) for h in hist))
 async def test_import_atomic_duplicate_and_digest(self):
  async def upload(action,data,**params): return await self.call('POST',self.path+'/imports/'+action,files={'file':('backlog.csv',data)},params=params)
  content=b'title,type,epic\nEpic,EPIC,\nStory,STORY,Epic\n'
  pre=await upload('preview',content);self.assertEqual(pre.status_code,200,pre.text);self.assertEqual((await self.call('GET',self.path+'/items')).json(),[])
  r=await upload('commit',content,expected_digest=pre.json()['digest']);self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['created'],2)
  pre=await upload('preview',content);self.assertEqual(pre.json()['duplicates'],2)
  r=await upload('commit',content,expected_digest=pre.json()['digest']);self.assertEqual(r.json()['skipped'],2)
  bad=b'title,type,epic\nValid,STORY,\nBad,STORY,missing\n';pre=await upload('preview',bad);self.assertEqual(pre.json()['error_rows'],1)
  r=await upload('commit',bad,expected_digest=pre.json()['digest']);self.assertEqual(r.status_code,422,r.text);self.assertEqual(len((await self.call('GET',self.path+'/items')).json()),2)
  r=await upload('commit',content,expected_digest='stale');self.assertEqual(r.status_code,409)
 async def test_mapping_xlsx_and_malformed(self):
  r=await self.call('POST',self.path+'/imports/preview',files={'file':('i.csv',b'Custom,Kind\nMapped,STORY\n')},params={'column_mapping':'{"title":0,"type":1}'});self.assertEqual(r.status_code,200,r.text)
  from openpyxl import Workbook
  wb=Workbook();wb.active.append(['title']);wb.active.append(['=1+1']);out=io.BytesIO();wb.save(out)
  r=await self.call('POST',self.path+'/imports/preview',files={'file':('i.xlsx',out.getvalue())});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['error_rows'],1)
  for name,data in [('i.xlsx',b'not zip'),('i.csv',b'wrong\nvalue\n')]:
   r=await self.call('POST',self.path+'/imports/preview',files={'file':(name,data)});self.assertEqual(r.status_code,422)
 async def test_history_reorder_activity_and_comments(self):
  a=await self.item(title='A');b=await self.item(title='B')
  r=await self.call('POST',self.path+'/backlog/reorder',json={'item_ids':[b['id'],a['id']]});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()[0]['id'],b['id'])
  for actor,code in [('observer',403),('dev',201)]:
   r=await self.call('POST',self.path+f"/items/{a['id']}/comments",actor,json={'content':'Note'});self.assertEqual(r.status_code,code,r.text)
  r=await self.call('GET',self.path+'/activity');self.assertEqual(r.status_code,200,r.text);self.assertGreater(len(r.json()),0)
 async def test_sprint_duration_and_google_url(self):
  r=await self.call('POST',self.path+'/sprints',json={'name':'Invalid','start_date':'2026-10-29','end_date':'2026-11-05'});self.assertEqual(r.status_code,422)
  r=await self.call('POST',self.path+'/imports/google/preview',json={'url':'https://example.com/private'});self.assertEqual(r.status_code,422)
 async def test_stale_edit_filters_and_sprint_extension(self):
  a=await self.item(title='Filter me',priority='HIGH')
  r=await self.call('PATCH',self.path+f"/items/{a['id']}",json={'status':'DONE','expected_updated_at':'2000-01-01T00:00:00Z'});self.assertEqual(r.status_code,409)
  r=await self.call('GET',self.path+'/items',params={'priority':'HIGH','q':'Filter','limit':1});self.assertEqual(len(r.json()),1)
  r=await self.call('GET',self.path+'/items',params={'status':'bad'});self.assertEqual(r.status_code,422)
  sprint=await self.sprint()
  r=await self.call('PATCH',self.path+f"/sprints/{sprint['id']}",json={'name':'Extended','start_date':'2026-10-29','end_date':'2026-11-18'});self.assertEqual(r.status_code,200,r.text)
 async def test_foreign_epic_and_sprint_assignment(self):
  other=(await self.call('POST','/projects',json={'key':'OTHER','name':'Other'})).json()
  e=(await self.call('POST',f"/projects/{other['id']}/items",json={'title':'Other epic','item_type':'EPIC'})).json()
  r=await self.call('POST',self.path+'/items',json={'title':'Leak','epic_id':e['id']});self.assertEqual(r.status_code,422)
  s=(await self.call('POST',f"/projects/{other['id']}/sprints",json={'name':'Other sprint','start_date':'2026-10-29','end_date':'2026-11-11'})).json()
  r=await self.call('POST',self.path+'/items',json={'title':'Leak','sprint_id':s['id']});self.assertEqual(r.status_code,422)
 async def test_import_update_history_and_limits(self):
  a=await self.item(title='Existing')
  data=b'title,priority,status\nExisting,HIGH,IN_PROGRESS\n'
  pre=await self.call('POST',self.path+'/imports/preview',files={'file':('i.csv',data)})
  r=await self.call('POST',self.path+'/imports/commit',files={'file':('i.csv',data)},params={'expected_digest':pre.json()['digest'],'duplicate_strategy':'update'});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['updated'],1)
  hist=(await self.call('GET',self.path+f"/items/{a['id']}/history")).json();self.assertTrue(any(h['field_name']=='priority' and h['new_value']=='HIGH' for h in hist))
  r=await self.call('POST',self.path+'/imports/preview',files={'file':('i.csv',b'title\n'+b'A\n'*2001)});self.assertEqual(r.status_code,413)
  r=await self.call('POST',self.path+'/imports/preview',files={'file':('i.csv',b'title\n'+b'A'*241+b'\n')});self.assertEqual(r.json()['error_rows'],1)
