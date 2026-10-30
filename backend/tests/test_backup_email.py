"""Real PostgreSQL integration tests. Use a disposable database named *test*.
Run migrations first. Each test TRUNCATES every application table.
SMTP is captured in memory except the dedicated local SMTP transport tests.
"""
import asyncio
import json
import os
import re
import unittest
from datetime import timedelta
from unittest.mock import patch

if "test" not in os.environ.get("DATABASE_URL", "").rsplit("/", 1)[-1].split("?")[0]:
    raise RuntimeError("Use a disposable DATABASE_URL with 'test' in its database name")
os.environ.update(IP_GUARD_ENABLED="false", SCHEDULER_ENABLED="false", ENVIRONMENT="development")
import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.core import database, email as mail
# Separate event loops per unittest case; never share pooled connections between loops.
database.engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, hide_parameters=True)
database.AsyncSessionLocal = async_sessionmaker(database.engine, expire_on_commit=False)
from app.main import app
from app.core.security import create_access_token
from app.crud import user as users
from app.models import User, UserRole
from app.models.backup_email import BackupEmail, BackupEmailChallenge, BackupEmailRateEvent
from app.models.base import utcnow
from app.services import backup_email as service

PATH = "/api/security/backup-email"
PASSWORD = "Test-only-Password-9!"


class BackupEmailTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        async with database.AsyncSessionLocal() as db:
            await db.execute(text("TRUNCATE users, audit_logs, backup_email_rate_events RESTART IDENTITY CASCADE"))
            await db.commit()
            self.user = await users.create(db, email="owner@example.com", password=PASSWORD)
            self.other = await users.create(db, email="other@example.com", password=PASSWORD)
        self.headers = {"Authorization": "Bearer " + create_access_token(self.user.id)}
        self.other_headers = {"Authorization": "Bearer " + create_access_token(self.other.id)}
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.messages = []
        self.sender = patch.object(service, "send_security_email", side_effect=lambda *args: self.messages.append(args))
        self.sender.start()
        self.original = {key: getattr(settings, key) for key in (
            "BACKUP_MAX_OPERATIONS_USER", "BACKUP_MAX_OPERATIONS_IP", "BACKUP_MAX_SENDS_USER",
            "BACKUP_MAX_SENDS_IP", "BACKUP_MAX_SENDS_DESTINATION", "EMAIL_BACKEND", "SMTP_HOST", "SMTP_PORT", "SMTP_TLS", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD", "ENVIRONMENT")}

    async def asyncTearDown(self):
        self.sender.stop()
        for key, value in self.original.items(): setattr(settings, key, value)
        await self.client.aclose()
        await database.engine.dispose()

    async def call(self, method, suffix="", payload=None, headers=None):
        return await self.client.request(method, PATH + suffix, json=payload, headers=headers or self.headers)

    async def request(self, email="backup@example.com", headers=None):
        return await self.call("POST", "/request", {"email": email, "current_password": PASSWORD}, headers)

    def code(self):
        return re.search(r"\b[0-9]{6}\b", self.messages[-1][2]).group()

    async def age(self, **kwargs):
        async with database.AsyncSessionLocal() as db:
            row = await db.get(BackupEmailChallenge, self.user.id)
            for key, value in kwargs.items(): setattr(row, key, value)
            await db.commit()

    async def activate(self, email="backup@example.com"):
        self.assertEqual((await self.request(email)).status_code, 200)
        response = await self.call("POST", "/verify", {"code": self.code()})
        self.assertEqual(response.status_code, 200)
        return response.json()

    async def test_every_endpoint_requires_auth_and_rejects_invalid_token(self):
        for method, suffix, body in [("GET", "", None), ("POST", "/request", {"email":"b@example.com", "current_password":PASSWORD}), ("POST", "/verify", {"code":"123456"}), ("POST", "/resend", {"current_password":PASSWORD}), ("DELETE", "", {"current_password":PASSWORD})]:
            for headers in ({}, {"Authorization":"Bearer invalid"}):
                r = await self.client.request(method, PATH + suffix, json=body, headers=headers)
                self.assertEqual(r.status_code, 401)

    async def test_validation_reauthentication_and_no_sensitive_echo(self):
        for email, expected in [("bad",422), ("OWNER@example.com",409), ("other@example.com",409)]:
            self.assertEqual((await self.request(email)).status_code, expected)
        for suffix in ("/request", "/resend"):
            body = {"current_password":"wrong", **({"email":"b@example.com"} if suffix == "/request" else {})}
            self.assertEqual((await self.call("POST", suffix, body)).status_code, 403)
        self.assertEqual((await self.call("DELETE", payload={"current_password":"wrong"})).status_code,403)
        for body in ({"email":"bad", "current_password":PASSWORD}, {"email":"b@example.com", "current_password":PASSWORD, "user_id":self.other.id}, {"email":"b@example.com", "current_password":"ñ"*40}):
            r = await self.call("POST", "/request", body)
            self.assertEqual(r.status_code,422)
            self.assertEqual(r.json(), {"detail":"backup_invalid_input"})
        r = await self.call("POST", "/verify", {"code":"private-invalid-code"})
        self.assertNotIn("private-invalid-code", r.text)

    async def test_complete_lifecycle_and_primary_unchanged(self):
        self.assertEqual((await self.call("GET")).json()["status"], "not_configured")
        r = await self.request("B.Ack+Tag@example.com")
        self.assertEqual(r.json()["pending_email"], "b.ack+tag@example.com")
        code = self.code()
        async with database.AsyncSessionLocal() as db:
            row = await db.get(BackupEmailChallenge, self.user.id)
            self.assertEqual(len(row.code_digest),64)
            self.assertNotEqual(row.code_digest, code)
        self.assertNotIn(code, r.text)
        r = await self.call("POST", "/verify", {"code":code})
        self.assertEqual(r.json()["email"], "b.ack+tag@example.com")
        self.assertTrue(r.json()["verified_at"])
        self.assertFalse(r.json()["recovery_available"])
        self.assertTrue(r.json()["notification_sent"])
        self.assertEqual(self.messages[-1][0], "owner@example.com")
        self.assertNotIn(code, self.messages[-1][2])
        self.assertEqual((await self.call("POST", "/verify", {"code":code})).status_code,409)
        me = await self.client.get("/api/auth/me",headers=self.headers)
        self.assertEqual(me.json()["email"],"owner@example.com")

    async def test_wrong_expired_and_exhausted_codes_persist(self):
        await self.request()
        good = self.code()
        bad = "000000" if good != "000000" else "000001"
        for index in range(5):
            r = await self.call("POST", "/verify", {"code":bad})
            self.assertEqual(r.status_code,429 if index==4 else 400)
        self.assertEqual((await self.call("POST", "/verify", {"code":good})).status_code,429)
        self.assertEqual((await self.call("GET")).json()["attempts_remaining"],0)
        await self.age(attempts=0,expires_at=utcnow()-timedelta(seconds=1))
        r = await self.call("POST", "/verify", {"code":good})
        self.assertEqual(r.json()["detail"],"backup_code_expired")

    async def test_resend_invalidates_and_cooldown_cannot_be_bypassed_by_new_destination(self):
        await self.request()
        old = self.code()
        self.assertEqual((await self.request("another@example.com")).status_code,429)
        self.assertEqual((await self.call("POST","/resend",{"current_password":PASSWORD})).status_code,429)
        await self.age(sent_at=utcnow()-timedelta(seconds=61))
        r = await self.call("POST","/resend",{"current_password":PASSWORD})
        self.assertEqual(r.status_code,200)
        new = self.code()
        self.assertNotEqual(new, old)
        self.assertEqual((await self.call("POST","/verify",{"code":old})).status_code,400)
        self.assertEqual((await self.call("POST","/verify",{"code":new})).status_code,200)

    async def test_change_keeps_old_until_verified_and_delete_cancels_pending(self):
        await self.activate()
        await self.request("new@example.com")
        pending_code = self.code()
        s = (await self.call("GET")).json()
        self.assertEqual(s["email"],"backup@example.com")
        self.assertEqual(s["pending_email"],"new@example.com")
        r = await self.call("POST","/verify",{"code":pending_code})
        self.assertEqual(r.json()["email"],"new@example.com")
        await self.request("third@example.com")
        pending_code = self.code()
        r = await self.call("DELETE",payload={"current_password":PASSWORD})
        self.assertEqual(r.json()["status"],"not_configured")
        self.assertIsNone(r.json()["pending_email"])
        self.assertEqual((await self.call("POST","/verify",{"code":pending_code})).status_code,409)

    async def test_cross_user_isolation_and_address_uniqueness(self):
        await self.activate()
        self.assertEqual((await self.call("GET",headers=self.other_headers)).json()["status"],"not_configured")
        self.assertEqual((await self.request(headers=self.other_headers)).status_code,409)
        r = await self.client.post("/api/auth/register",json={"email":"backup@example.com", "password":PASSWORD})
        self.assertEqual(r.status_code,409)
        r = await self.client.patch("/api/users/me/email",headers=self.other_headers,json={"current_email":"other@example.com", "new_email":"backup@example.com","current_password":PASSWORD})
        self.assertEqual(r.status_code,409)
        for method,suffix,body in [("POST","/verify",{"code":"123456"}), ("DELETE","",{"current_password":PASSWORD}), ("POST","/resend",{"current_password":PASSWORD})]:
            r = await self.call(method,suffix,{**body,"user_id":self.user.id},self.other_headers)
            self.assertEqual(r.status_code,422)
        self.assertEqual((await self.call("GET",suffix="?user_id="+str(self.other.id))).json()["email"],"backup@example.com")

    async def test_smtp_failure_rolls_back_request_resend_and_change(self):
        with patch.object(service,"send_security_email",side_effect=RuntimeError("private smtp detail")):
            r = await self.request()
            self.assertEqual(r.status_code,503)
            self.assertNotIn("private smtp detail", r.text)
        self.assertEqual((await self.call("GET")).json()["status"],"not_configured")
        await self.activate()
        await self.request("new@example.com")
        old_code = self.code()
        await self.age(sent_at=utcnow()-timedelta(seconds=61))
        for suffix,body in [("/resend",{"current_password":PASSWORD}), ("/request",{"current_password":PASSWORD,"email":"next@example.com"})]:
            with patch.object(service,"send_security_email",side_effect=RuntimeError("private")):
                self.assertEqual((await self.call("POST",suffix,body)).status_code,503)
            s=(await self.call("GET")).json()
            self.assertEqual(s["email"],"backup@example.com")
            self.assertEqual(s["pending_email"],"new@example.com")
        self.assertEqual((await self.call("POST","/verify",{"code":old_code})).status_code,200)

    async def test_failed_notification_does_not_claim_failed_mutation(self):
        await self.request()
        code=self.code()
        with patch.object(service,"send_security_email",side_effect=RuntimeError("private")):
            r=await self.call("POST","/verify",{"code":code})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()["status"],"verified")
        self.assertFalse(r.json()["notification_sent"])

    async def test_persistent_user_ip_and_destination_limits(self):
        settings.BACKUP_MAX_OPERATIONS_USER=1
        await self.call("DELETE",payload={"current_password":"bad"})
        self.assertEqual((await self.call("DELETE",payload={"current_password":PASSWORD})).status_code,429)
        settings.BACKUP_MAX_OPERATIONS_USER=30
        settings.BACKUP_MAX_OPERATIONS_IP=1
        self.assertEqual((await self.request(headers=self.other_headers)).status_code,429)
        settings.BACKUP_MAX_OPERATIONS_IP=120
        settings.BACKUP_MAX_SENDS_DESTINATION=1
        await self.request()
        r=await self.request(headers=self.other_headers)
        self.assertEqual(r.status_code,429)
        async with database.AsyncSessionLocal() as db:
            rows=(await db.scalars(select(BackupEmailRateEvent))).all()
            self.assertTrue(rows)
            self.assertTrue(all(len(row.key)==64 and "@" not in row.key for row in rows))
        # New app client/connection still sees the quota; no process-local limiter involved.
        await database.engine.dispose()
        self.assertEqual((await self.request(headers=self.other_headers)).status_code,429)

    async def test_concurrent_verify_only_one_wins(self):
        await self.request()
        code=self.code()
        results=await asyncio.gather(*[self.call("POST","/verify",{"code":code}) for _ in range(4)])
        self.assertEqual(sorted(r.status_code for r in results),[200,409,409,409])

    async def test_concurrent_address_ownership_and_primary_registration(self):
        await self.request("shared@example.com")
        first=self.code()
        await self.request("shared@example.com",self.other_headers)
        second=self.code()
        results=await asyncio.gather(self.call("POST","/verify",{"code":first}), self.call("POST","/verify",{"code":second},self.other_headers))
        self.assertEqual(sorted(r.status_code for r in results),[200,409])
        # Primary registration can win before an unverified proposal; verification rechecks it.
        if (await self.call("GET")).json()["pending_email"]:
            await self.age(sent_at=utcnow()-timedelta(seconds=61))
        r=await self.request("registered-later@example.com")
        self.assertEqual(r.status_code,200)
        code=self.code()
        r=await self.client.post("/api/auth/register",json={"email":"registered-later@example.com","password":PASSWORD})
        self.assertEqual(r.status_code,201)
        self.assertEqual((await self.call("POST","/verify",{"code":code})).status_code,409)

    async def test_concurrent_requests_send_only_once_and_delete_race_is_consistent(self):
        results=await asyncio.gather(self.request(),self.request())
        self.assertEqual(sorted(r.status_code for r in results),[200,429])
        self.assertEqual(len(self.messages),1)
        code=self.code()
        await asyncio.gather(self.call("POST","/verify",{"code":code}),self.call("DELETE",payload={"current_password":PASSWORD}))
        self.assertEqual((await self.call("GET")).json()["status"],"not_configured")

    async def test_audit_redaction_for_staff_and_users_and_cascade_cleanup(self):
        async with database.AsyncSessionLocal() as db:
            u=await db.get(User,self.user.id);u.role=UserRole.ADMIN;await db.commit()
        await self.request()
        code=self.code()
        await self.call("POST","/verify",{"code":code})
        async with database.AsyncSessionLocal() as db:
            rows=(await db.execute(text("SELECT action, changes, entity_label, user_email FROM audit_logs WHERE entity='backup_emails'"))).all()
            self.assertEqual(len(rows),2)
            for row in rows:
                self.assertIsNone(row.changes); self.assertIsNone(row.entity_label); self.assertIsNone(row.user_email)
            u=await db.get(User,self.user.id);await db.delete(u);await db.commit()
            self.assertIsNone(await db.get(BackupEmail,self.user.id))
            self.assertIsNone(await db.get(BackupEmailChallenge,self.user.id))
        self.assertEqual((await self.call("GET")).status_code,401)

    async def test_retention_cleanup(self):
        await self.request()
        await self.age(expires_at=utcnow()-timedelta(days=2))
        async with database.AsyncSessionLocal() as db:
            db.add(BackupEmailRateEvent(key="a"*64,created_at=utcnow()-timedelta(hours=3)))
            await db.commit()
            await service.crud.purge(db)
            self.assertIsNone(await db.get(BackupEmailChallenge,self.user.id))
            self.assertIsNone(await db.scalar(select(BackupEmailRateEvent).where(BackupEmailRateEvent.key=="a"*64)))

    async def test_openapi_has_all_operations_without_target_user(self):
        schema=(await self.client.get("/api/openapi.json")).json()
        for path in (PATH,PATH+"/request",PATH+"/verify",PATH+"/resend"):
            self.assertIn(path,schema["paths"])
        for name in ("BackupEmailRequest","BackupEmailResend","BackupEmailVerify","BackupEmailDelete"):
            self.assertNotIn("user_id",schema["components"]["schemas"][name]["properties"])

    async def test_security_mail_transport_real_local_smtp_and_no_console_leak(self):
        from aiosmtpd.controller import Controller
        import socket
        received=[]
        class Handler:
            async def handle_DATA(self, server, session, envelope):
                received.append(envelope)
                return "250 OK"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
        controller=Controller(Handler(),hostname="127.0.0.1",port=port)
        controller.start()
        settings.EMAIL_BACKEND="smtp";settings.SMTP_HOST="127.0.0.1";settings.SMTP_PORT=port
        settings.SMTP_TLS="none";settings.SMTP_FROM="noreply@example.com";settings.SMTP_USER=None;settings.SMTP_PASSWORD=None
        try:
            with patch.object(service,"send_security_email",side_effect=mail.send_security_email):
                r=await self.request()
            self.assertEqual(r.status_code,200)
            self.assertEqual(received[0].rcpt_tos,["backup@example.com"])
            self.assertRegex(received[0].content.decode(),r"[0-9]{6}")
            settings.EMAIL_BACKEND="console"
            with patch.object(mail,"_deliver_console") as console:
                with self.assertRaises(RuntimeError): mail.send_security_email("backup@example.com","subject","private")
                console.assert_not_called()
            settings.EMAIL_BACKEND="smtp";settings.ENVIRONMENT="production"
            with self.assertRaises(RuntimeError): mail.send_security_email("backup@example.com","subject","private")
        finally:
            controller.stop()


    async def test_concurrent_resends_refresh_challenge_after_rate_transaction(self):
        await self.request()
        await self.age(sent_at=utcnow()-timedelta(seconds=61))
        initial_count=len(self.messages)
        results=await asyncio.gather(*[self.call("POST","/resend",{"current_password":PASSWORD}) for _ in range(3)])
        self.assertEqual(sorted(r.status_code for r in results),[200,429,429])
        self.assertEqual(len(self.messages),initial_count+1)

    async def test_verification_vs_primary_registration_is_serialized(self):
        await self.request("race@example.com")
        code=self.code()
        results=await asyncio.gather(
            self.call("POST","/verify",{"code":code}),
            self.client.post("/api/auth/register",json={"email":"race@example.com","password":PASSWORD}))
        self.assertIn(sorted(r.status_code for r in results),[[200,409],[201,409]])

    async def test_forwarded_headers_do_not_bypass_ip_quota(self):
        settings.BACKUP_MAX_OPERATIONS_IP=1
        await self.call("DELETE",payload={"current_password":"bad"})
        r=await self.call("DELETE",payload={"current_password":PASSWORD},headers={**self.other_headers,"X-Forwarded-For":"192.0.2.42","X-Real-IP":"192.0.2.43"})
        self.assertEqual(r.status_code,429)


    async def test_security_transport_never_logs_contents_or_smtp_exception(self):
        settings.EMAIL_BACKEND="smtp";settings.SMTP_HOST="smtp.example.com"
        settings.SMTP_FROM="noreply@example.com";settings.SMTP_TLS="starttls"
        with patch.object(mail,"logger") as logger:
            with patch.object(mail,"_deliver_smtp"):
                mail.send_security_email("backup@example.com","subject","sensitive-test-body")
            with patch.object(mail,"_deliver_smtp",side_effect=RuntimeError("sensitive-test-body")):
                with self.assertRaises(RuntimeError) as caught:
                    mail.send_security_email("backup@example.com","subject","sensitive-test-body")
                self.assertEqual(str(caught.exception),"Security mail delivery failed")
            self.assertEqual(logger.mock_calls,[])
