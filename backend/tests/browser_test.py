"""Disposable test DB only. Real browser/API/SMTP lifecycle, no mocked UI responses.
Requires npm ci and npx playwright install chromium --only-shell in frontend/.
"""
import asyncio
import email
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.request
from aiosmtpd.controller import Controller


def main():
    if "test" not in os.environ.get("DATABASE_URL", "").rsplit("/", 1)[-1].split("?")[0]:
        raise RuntimeError("Use a disposable database named *test*")
    os.environ.update(ENVIRONMENT="development", IP_GUARD_ENABLED="false", SCHEDULER_ENABLED="false")
    from app.core.database import AsyncSessionLocal, engine
    from sqlalchemy import text
    async def reset():
        async with AsyncSessionLocal() as db:
            await db.execute(text("TRUNCATE users, audit_logs, backup_email_rate_events RESTART IDENTITY CASCADE"))
            await db.commit()
        await engine.dispose()
    asyncio.run(reset())
    with tempfile.TemporaryDirectory(prefix="ajr-browser-") as temp:
        mailbox = Path(temp) / "mail.json"
        mailbox.write_text("[]")
        mailbox.chmod(0o600)
        messages=[]
        class Handler:
            async def handle_DATA(self, server, session, envelope):
                message=email.message_from_bytes(envelope.content)
                text_=message.get_payload(decode=True).decode("utf-8")
                match=re.search(r"\b[0-9]{6}\b",text_)
                messages.append({"to":envelope.rcpt_tos[0],"code":match.group() if match else ""})
                next_file=mailbox.with_suffix(".tmp")
                next_file.write_text(json.dumps(messages));next_file.replace(mailbox)
                return "250 OK"
        smtp=Controller(Handler(),hostname="127.0.0.1",port=2525)
        smtp.start()
        env=os.environ.copy()
        env.update(EMAIL_BACKEND="smtp", SMTP_HOST="127.0.0.1", SMTP_PORT="2525", SMTP_TLS="none", SMTP_FROM="noreply@example.com", SMTP_USER="", SMTP_PASSWORD="", BACKUP_RESEND_SECONDS="1", AJR_E2E_MAILBOX=str(mailbox), AJR_E2E_PASSWORD=secrets.token_urlsafe(24)+"Aa1!", TURNSTILE_SECRET_KEY="")
        backend=Path(__file__).resolve().parents[1]
        with open(Path(temp)/"api.log","w") as log:
            server=subprocess.Popen([sys.executable,"-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000"],cwd=backend,env=env,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        urllib.request.urlopen("http://127.0.0.1:8000/api/health",timeout=1)
                        break
                    except OSError: time.sleep(.1)
                else: raise RuntimeError("API did not start")
                result=subprocess.call(["npx","playwright","test"],cwd=backend.parent/"frontend",env=env)
                if result: raise RuntimeError("Browser checks failed")
            finally:
                server.terminate();server.wait(timeout=15);smtp.stop()

if __name__ == "__main__":
    main()
