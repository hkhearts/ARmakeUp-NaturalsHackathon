import cv2
import numpy as np
import base64
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
import math

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Skin Tone Matrix from your provided image
SKIN_MATRIX = {
    "Cool": {
        90: "#EDE1DD", 80: "#E0C1B7", 70: "#D1A393", 60: "#CC7F65", 
        50: "#BF5F3F", 40: "#934F38", 30: "#6E3B2A"
    },
    "Neutral": {
        90: "#EDE4DD", 80: "#E0C8B7", 70: "#D1AD93", 60: "#CC9065", 
        50: "#BF743F", 40: "#935E38", 30: "#6E462A"
    },
    "Warm": {
        90: "#EDE6DD", 80: "#E0CFB7", 70: "#D1B793", 60: "#CCA165", 
        50: "#BF8A3F", 40: "#936D38", 30: "#6E522A"
    }
}

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def adjust_lightness(hex_color, factor):
    """Artificially lightens or darkens a hex color for concealer/contour"""
    rgb = hex_to_rgb(hex_color)
    new_rgb = [max(0, min(255, c * factor)) for c in rgb]
    return rgb_to_hex(new_rgb)

def analyze_tone(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    h, w, _ = img.shape
    center_crop = img[int(h*0.4):int(h*0.6), int(w*0.4):int(w*0.6)]
    
    lab = cv2.cvtColor(center_crop, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    mean_l_cv = np.mean(l)
    lightness = (mean_l_cv / 255.0) * 100
    
    mean_a = np.mean(a)
    mean_b = np.mean(b)
    
    if mean_b > mean_a + 3:
        undertone = "Warm"
    elif mean_a > mean_b + 3:
        undertone = "Cool"
    else:
        undertone = "Neutral"

    matrix_levels = [90, 80, 70, 60, 50, 40, 30]
    closest_l = min(matrix_levels, key=lambda x: abs(x - lightness))
    
    foundation_hex = SKIN_MATRIX[undertone][closest_l]
    concealer_hex = adjust_lightness(foundation_hex, 1.2)
    contour_hex = adjust_lightness(foundation_hex, 0.7)

    if undertone == "Warm":
        blush_hex = "#E87A5D" if closest_l > 50 else "#A64B38"
        lipstick_hex = "#CC4A3D" if closest_l > 50 else "#8B2A1E"
    elif undertone == "Cool":
        blush_hex = "#E86F88" if closest_l > 50 else "#993B54"
        lipstick_hex = "#C42D5F" if closest_l > 50 else "#751836"
    else:
        blush_hex = "#D67373" if closest_l > 50 else "#8F4545"
        lipstick_hex = "#B54352" if closest_l > 50 else "#6E2430"

    surface_desc = f"Lightness Level {int(lightness)} (~{closest_l})"

    recs = {
        "foundation": foundation_hex,
        "concealer": concealer_hex,
        "contour": contour_hex,
        "blush": blush_hex,
        "lipstick": lipstick_hex
    }

    return {"surface_tone": surface_desc, "undertone": undertone, "recommendations": recs}

@app.post("/analyze")
async def analyze_face(image: str = Form(...)):
    image_data = base64.b64decode(image.split(",")[1])
    return analyze_tone(image_data)