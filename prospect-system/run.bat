@echo off
REM Helper script for Windows — sets UTF-8 encoding and runs the CLI
set PYTHONIOENCODING=utf-8
venv\Scripts\python.exe main.py %*
