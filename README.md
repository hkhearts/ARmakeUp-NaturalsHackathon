# ✨ AI Beauty Studio AR

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![MediaPipe](https://img.shields.io/badge/MediaPipe-00B4D8?style=for-the-badge)

**AI Beauty Studio AR** is a real-time, browser-based Augmented Reality application that uses Computer Vision to analyze your skin tone and undertone, automatically recommending and applying perfectly matched makeup shades directly to your face.

> **Note:** Add a GIF or screenshot of the app running here!
> `![App Demo](link_to_your_image_or_gif.gif)`

---

## 🌟 Key Features

* **Real-Time AR Tracking**: Utilizes Google's MediaPipe Face Mesh for precise, lag-free facial landmark tracking.
* **Deep Skin Analysis**: The Python backend processes webcam frames using the LAB color space to determine your exact Surface Tone (Lightness) and Undertone (Cool, Neutral, Warm).
* **Smart Shade Matrix Matrix**: Maps your skin analysis to an internal beauty matrix to automatically generate custom hex codes for:
  * 🧴 Foundation (Perfect match)
  * ✨ Concealer (Calculated 1-2 shades lighter)
  * 🤎 Contour (Calculated shadows for cheekbones)
  * 😊 Blush (Undertone-specific flush)
  * 💋 Lipstick (Harmonized lip color)
* **Full Manual Control**: Disagree with the AI? Use the built-in color pickers and intensity sliders to customize your look instantly.
* **Exportable Beauty Report**: Generate and download a personalized `.txt` report of your recommended hex codes to help you shop for real physical products.

---

## 🛠️ How It Works

1. **The Frontend (`index.html`)**: Captures webcam video and runs MediaPipe Face Mesh. It handles the UI, draws the AR makeup on the HTML5 Canvas, and sends snapshot frames to the backend.
2. **The Backend (`main.py`)**: A lightweight FastAPI server. It decodes the image, isolates the center of the face, converts the image to the `LAB` color space, and calculates the `L` (Lightness), `A` (Green-Red), and `B` (Blue-Yellow) values to accurately classify the user's skin profile against our custom matrix.

---

## 🚀 Installation & Setup

To run this project locally, you will need to start the Python backend and open the HTML frontend.

### Prerequisites
* Python 3.8+
* A modern web browser (Chrome, Edge, Safari)
* A working webcam

### Step 1: Clone the Repository
```bash
git clone [https://github.com/hkhearts/ARmakeUp-NaturalsHackathon.git]
cd ARmakeUp-NaturalsHackathon

Step 2: Set Up the Backend

Install the required Python dependencies:



Bash



pip install fastapi uvicorn opencv-python numpy python-multipart

Start the FastAPI server:



Bash



uvicorn main:app --reload

The server will start running on http://127.0.0.1:8000.



Step 3: Launch the Frontend

Because the frontend requires camera permissions, it is best run on a local server rather than just double-clicking the file.

If you use VS Code, install the Live Server extension, right-click index.html, and select "Open with Live Server".

Alternatively, you can use Python to serve the folder:

python -m http.server 5500

Then navigate to http://localhost:5500/index.html in your browser.

🎮 Usage Guide

Allow Camera Access: When prompted by your browser, allow webcam permissions.

Analyze Skin: Click the "🔍 Auto Match Skin Tone" button. Hold still in good lighting while the Python server analyzes your face.

Toggle Makeup: Click the buttons (Foundation, Concealer, Contour, etc.) to toggle the AR rendering on and off.

Customize: Use the sliders to adjust opacity and click the color swatches to manually pick new hex codes.

Download: Click "📝 Download Beauty Report" to save your custom shade profile!

📂 Project Structure


📦 ai-beauty-studio

┣ 📜 main.py # FastAPI backend (Skin analysis & matrix logic)

┣ 📜 index.html # UI, MediaPipe AR engine, and frontend logic

┗ 📜 README.md # Project documentation


🔮 Future Enhancements

[ ] Add Eye Makeup (Eyeliner, Eyeshadow palettes)

[ ] Implement varied lip finishes (Matte, Glossy, Metallic)

[ ] Deploy backend to a cloud service (Render/Heroku)

[ ] Add support for taking and saving photos


📄 Work

Built with ❤️ bridging the gap between Computer Vision and Beauty Tech.

