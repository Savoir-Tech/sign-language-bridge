@echo off
echo === ST-GCN ASL Recognition - Environment Setup (Python 3.10) ===

where py >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python Launcher [py] not found. Install Python 3.10 from python.org.
    pause
    exit /b 1
)

py -3.10 --version >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python 3.10 not found. Install it from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Creating venv with Python 3.10...
py -3.10 -m venv venv
call venv\Scripts\activate.bat

pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Checking installation...
python -c "import torch; print(f'PyTorch   {torch.__version__}')"
python -c "import mediapipe as mp; print(f'MediaPipe {mp.__version__}')"
python -c "import cv2; print(f'OpenCV    {cv2.__version__}')"
python -c "import numpy; print(f'NumPy     {numpy.__version__}')"

echo.
echo Setup complete. Activate with: venv\Scripts\activate.bat
echo.
echo Next steps:
echo   1. Extract poses:  python extract_poses.py --split train
echo   2. Train model:    python train.py
echo   3. Evaluate:       python test.py --checkpoint trained_models/best_model.pt
echo   4. Export:          python export_model.py --checkpoint trained_models/best_model.pt
pause
