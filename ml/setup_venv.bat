@echo off
REM Quick setup script for ML virtual environment (Python 3.10)

echo ========================================================================
echo Setting up ML Virtual Environment (Python 3.10)
echo ========================================================================
echo.

REM Check if Python 3.10 is available
where python3.10 >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python3.10
    echo Found Python 3.10 in PATH
) else (
    REM Try common installation paths
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python310\python.exe" (
        set PYTHON_CMD=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python310\python.exe
        echo Found Python 3.10 at %PYTHON_CMD%
    ) else if exist "C:\Python310\python.exe" (
        set PYTHON_CMD=C:\Python310\python.exe
        echo Found Python 3.10 at %PYTHON_CMD%
    ) else (
        echo ERROR: Python 3.10 not found!
        echo.
        echo Please install Python 3.10 from:
        echo   - Microsoft Store: Search "Python 3.10"
        echo   - Official: https://www.python.org/downloads/release/python-31011/
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Using: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

REM Create virtual environment
echo Creating virtual environment...
%PYTHON_CMD% -m venv venv
if errorlevel 1 goto error

REM Activate venv
echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 goto error

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 goto error

REM Install requirements
echo.
echo Installing dependencies from requirements.txt...
pip install -r requirements.txt
if errorlevel 1 goto error

REM Verify installation
echo.
echo ========================================================================
echo Verifying Installation
echo ========================================================================
echo.

python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import mediapipe; print(f'MediaPipe: {mediapipe.__version__}')"
python -c "import cv2; print(f'OpenCV: {cv2.__version__}')"
python -c "import numpy; print(f'NumPy: {numpy.__version__}')"

echo.
echo ========================================================================
echo Setup Complete!
echo ========================================================================
echo.
echo Virtual environment created at: ml\venv
echo.
echo To activate the environment:
echo   venv\Scripts\activate
echo.
echo To run landmark extraction:
echo   venv\Scripts\activate
echo   python scripts\extract_landmarks.py --split train
echo.
echo To train the model:
echo   venv\Scripts\activate
echo   python scripts\train_asl_lstm.py --epochs 100
echo.

pause
goto end

:error
echo.
echo ========================================================================
echo ERROR: Setup failed!
echo ========================================================================
echo Please check the error messages above and try again.
echo.
pause
exit /b 1

:end
