@echo off
chcp 65001 > nul
echo ========================================================
echo   🚀 Majarra Image Batch Generator (Flow Runner)
echo ========================================================
echo.

if "%GEMINI_API_KEY%"=="" (
    set /p GEMINI_API_KEY="🔑 Enter your Gemini API Key: "
)

if "%GEMINI_API_KEY%"=="" (
    echo ❌ API Key is required to run image generation!
    pause
    exit /b 1
)

python tools\image_batch_generator.py --input IMAGE_PROMPTS.txt --api-key %GEMINI_API_KEY%

echo.
echo Operation finished. Press any key to exit...
pause > nul
