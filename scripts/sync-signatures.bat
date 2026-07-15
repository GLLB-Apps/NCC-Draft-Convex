@echo off
REM Runs the signature sync from a normal (residential) IP so Cloudflare lets it
REM through. Point a Windows Task Scheduler "Start a program" action at this file
REM to update the count daily. No "Start in" needed — it cd's to the project.
cd /d "%~dp0.."
node scripts\sync-signatures.mjs
