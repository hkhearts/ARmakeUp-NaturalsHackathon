"""
Skin Tone Analyzer — Core Engine
=================================
Analyzes a face image to determine:
  - Undertone (Warm / Cool / Neutral)
  - Surface tone / lightness level
  - Recommended makeup colors (foundation, concealer, contour, blush, lipstick)

Uses OpenCV LAB color space analysis on skin pixels sampled from
forehead + cheek regions detected via MediaPipe Face Mesh.
"""

import base64
import cv2
import numpy as np

try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False


# ---------------------------------------------------------------------------
# Landmark indices for skin sampling regions (avoid eyes, mouth, eyebrows)
# ---------------------------------------------------------------------------
# Forehead center region
FOREHEAD_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454,
                    323, 361, 288, 397, 365, 379, 378, 400, 377,
                    152, 148, 176, 149, 150, 136, 172, 58, 132,
                    93, 234, 127, 162, 21, 54, 103, 67, 109]

# Cheek sample points (centers of cheek area)
LEFT_CHEEK_SAMPLE = [205, 36, 142, 126, 217]
RIGHT_CHEEK_SAMPLE = [425, 266, 371, 355, 437]

# Forehead sample points (above eyebrows)
FOREHEAD_SAMPLE = [10, 108, 69, 104, 68, 71, 299, 337, 338, 297]


# ---------------------------------------------------------------------------
# Color recommendation database
# ---------------------------------------------------------------------------
COLOR_DATABASE = {
    'warm': {
        'fair': {
            'foundation': ['#F5D6BA', '#F0C8A0', '#EBBD96'],
            'concealer': ['#FAE5D0', '#F7DCC4', '#F5D3B8'],
            'contour':   ['#C8A07A', '#B8956E', '#A88A64'],
            'blush':     ['#E8967A', '#F0A08C', '#D4836E'],
            'lipstick':  ['#C8645A', '#D47B72', '#E09688', '#B85450', '#A0463E'],
            'bindi':     ['#CC0000', '#8B0000', '#FFD700', '#FF4500'],
        },
        'light': {
            'foundation': ['#E8C4A0', '#DEBB96', '#D4B28C'],
            'concealer': ['#F0D4B4', '#ECCAAA', '#E8C0A0'],
            'contour':   ['#B8946A', '#A88860', '#988056'],
            'blush':     ['#D48C6E', '#E09678', '#C48264'],
            'lipstick':  ['#B8564A', '#C46858', '#D07A6C', '#A04840', '#8C3C36'],
            'bindi':     ['#CC0000', '#8B0000', '#FFD700', '#C04000'],
        },
        'medium': {
            'foundation': ['#D4A87A', '#CA9E70', '#C09466'],
            'concealer': ['#E0B88E', '#DCAE84', '#D8A47A'],
            'contour':   ['#A07850', '#907048', '#806840'],
            'blush':     ['#C07854', '#CC825E', '#B46E4A'],
            'lipstick':  ['#A04838', '#B05A48', '#C06C58', '#8C3C30', '#7C3028'],
            'bindi':     ['#8B0000', '#CC0000', '#FF4500', '#C04000'],
        },
        'tan': {
            'foundation': ['#C09060', '#B68858', '#AC8050'],
            'concealer': ['#D0A070', '#CCA068', '#C89860'],
            'contour':   ['#886840', '#7C6038', '#705830'],
            'blush':     ['#A86848', '#B47252', '#9C5E3E'],
            'lipstick':  ['#8C3428', '#983E32', '#A4483C', '#7C2C22', '#6C241C'],
            'bindi':     ['#8B0000', '#800020', '#FF4500', '#FFD700'],
        },
        'deep': {
            'foundation': ['#8C6840', '#825E38', '#785430'],
            'concealer': ['#A07850', '#987048', '#906840'],
            'contour':   ['#604828', '#584020', '#503818'],
            'blush':     ['#904C30', '#9C563A', '#844226'],
            'lipstick':  ['#7C2820', '#882E26', '#6C2018', '#601C14', '#942C28'],
            'bindi':     ['#CC0000', '#800020', '#FFD700', '#4B0082'],
        },
    },
    'cool': {
        'fair': {
            'foundation': ['#F0D0C0', '#ECC8B8', '#E8C0B0'],
            'concealer': ['#F8DCD0', '#F5D4C8', '#F2CCC0'],
            'contour':   ['#C09888', '#B49080', '#A88878'],
            'blush':     ['#D48C9C', '#E096A6', '#C88290'],
            'lipstick':  ['#B85068', '#C45C74', '#D06880', '#A44860', '#904058'],
            'bindi':     ['#CC0000', '#800020', '#FFD700', '#4B0082'],
        },
        'light': {
            'foundation': ['#E4BEB0', '#DEB6A8', '#D8AEA0'],
            'concealer': ['#F0CCBC', '#ECC4B4', '#E8BCAC'],
            'contour':   ['#B08878', '#A48070', '#987868'],
            'blush':     ['#C47C8C', '#D08696', '#B87282'],
            'lipstick':  ['#A44860', '#B0546C', '#BC6078', '#984058', '#8C3850'],
            'bindi':     ['#8B0000', '#CC0000', '#800020', '#FFD700'],
        },
        'medium': {
            'foundation': ['#CCA090', '#C49888', '#BC9080'],
            'concealer': ['#D8AE9C', '#D4A694', '#D09E8C'],
            'contour':   ['#967060', '#8A6858', '#7E6050'],
            'blush':     ['#A86878', '#B47282', '#9C5E6E'],
            'lipstick':  ['#8C3850', '#98445C', '#A45068', '#803048', '#742840'],
            'bindi':     ['#8B0000', '#CC0000', '#FFD700', '#C04000'],
        },
        'tan': {
            'foundation': ['#B48870', '#AC8068', '#A47860'],
            'concealer': ['#C49880', '#C09078', '#BC8870'],
            'contour':   ['#7C5848', '#705040', '#644838'],
            'blush':     ['#905460', '#9C5E6A', '#844A56'],
            'lipstick':  ['#782C40', '#84384C', '#904458', '#6C2438', '#601C30'],
            'bindi':     ['#CC0000', '#800020', '#FFD700', '#4B0082'],
        },
        'deep': {
            'foundation': ['#886050', '#7E5848', '#745040'],
            'concealer': ['#987060', '#907058', '#886850'],
            'contour':   ['#584030', '#503828', '#483020'],
            'blush':     ['#784050', '#844A5A', '#6C3646'],
            'lipstick':  ['#682440', '#74304C', '#601C38', '#541430', '#802C48'],
            'bindi':     ['#8B0000', '#CC0000', '#FFD700', '#4B0082'],
        },
    },
    'neutral': {
        'fair': {
            'foundation': ['#F2D4BC', '#EEC8B0', '#EABCA4'],
            'concealer': ['#F8E0CC', '#F5D8C4', '#F2D0BC'],
            'contour':   ['#C4A088', '#B89880', '#AC9078'],
            'blush':     ['#D89090', '#E49A9A', '#CC8686'],
            'lipstick':  ['#C05868', '#CC6474', '#D87080', '#B45060', '#A04858'],
            'bindi':     ['#CC0000', '#8B0000', '#FFD700', '#FF4500'],
        },
        'light': {
            'foundation': ['#E4C0A8', '#DEB8A0', '#D8B098'],
            'concealer': ['#F0CEB4', '#ECC6AC', '#E8BEA4'],
            'contour':   ['#AC8870', '#A08068', '#947860'],
            'blush':     ['#C48080', '#D08A8A', '#B87676'],
            'lipstick':  ['#A84C5C', '#B45868', '#C06474', '#9C4454', '#903C4C'],
            'bindi':     ['#CC0000', '#8B0000', '#FFD700', '#C04000'],
        },
        'medium': {
            'foundation': ['#D0A488', '#C89C80', '#C09478'],
            'concealer': ['#DCB098', '#D8A890', '#D4A088'],
            'contour':   ['#907058', '#847050', '#786848'],
            'blush':     ['#A86C70', '#B4767A', '#9C6266'],
            'lipstick':  ['#903C4C', '#9C4858', '#A85464', '#843444', '#78303C'],
            'bindi':     ['#8B0000', '#CC0000', '#FF4500', '#800020'],
        },
        'tan': {
            'foundation': ['#BC8C68', '#B48460', '#AC7C58'],
            'concealer': ['#CC9C78', '#C89470', '#C48C68'],
            'contour':   ['#786040', '#6C5838', '#605030'],
            'blush':     ['#945858', '#A06262', '#884E4E'],
            'lipstick':  ['#7C3040', '#88384C', '#944458', '#702838', '#642030'],
            'bindi':     ['#CC0000', '#800020', '#FFD700', '#4B0082'],
        },
        'deep': {
            'foundation': ['#886448', '#7E5C40', '#745438'],
            'concealer': ['#987458', '#907450', '#886C48'],
            'contour':   ['#584430', '#504028', '#483820'],
            'blush':     ['#804448', '#8C4E52', '#743A3E'],
            'lipstick':  ['#6C2838', '#783044', '#601C30', '#541428', '#842C40'],
            'bindi':     ['#8B0000', '#CC0000', '#FFD700', '#4B0082'],
        },
    },
}


class SkinToneAnalyzer:
    """
    Analyzes skin tone from a face image.

    Supports two modes:
      1. Automatic — uses MediaPipe to locate face, samples skin pixels
      2. Manual — user provides a specific ROI or hex color
    """

    def __init__(self):
        self.face_mesh = None
        if HAS_MEDIAPIPE:
            self.face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
            )

    def decode_base64_image(self, b64_string: str) -> np.ndarray:
        """Decode a base64-encoded image string to an OpenCV BGR array."""
        # Strip data URI prefix if present
        if ',' in b64_string:
            b64_string = b64_string.split(',', 1)[1]
        img_bytes = base64.b64decode(b64_string)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image")
        return img

    def _get_face_landmarks(self, img_rgb: np.ndarray):
        """Run MediaPipe face mesh and return normalized landmarks."""
        if self.face_mesh is None:
            return None
        results = self.face_mesh.process(img_rgb)
        if results.multi_face_landmarks:
            return results.multi_face_landmarks[0]
        return None

    def _sample_skin_pixels_mediapipe(self, img_bgr: np.ndarray, landmarks) -> np.ndarray:
        """Sample skin pixels from forehead and cheeks using MediaPipe landmarks."""
        h, w = img_bgr.shape[:2]
        pixels = []

        sample_indices = FOREHEAD_SAMPLE + LEFT_CHEEK_SAMPLE + RIGHT_CHEEK_SAMPLE

        for idx in sample_indices:
            lm = landmarks.landmark[idx]
            cx, cy = int(lm.x * w), int(lm.y * h)
            # Sample a 10x10 patch around each landmark
            radius = 5
            x1 = max(0, cx - radius)
            y1 = max(0, cy - radius)
            x2 = min(w, cx + radius)
            y2 = min(h, cy + radius)
            patch = img_bgr[y1:y2, x1:x2]
            if patch.size > 0:
                pixels.append(patch.reshape(-1, 3))

        if pixels:
            return np.vstack(pixels)
        return np.array([])

    def _sample_skin_pixels_fallback(self, img_bgr: np.ndarray) -> np.ndarray:
        """Fallback: use OpenCV face detection + center region sampling."""
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            # Last resort: sample center of image
            h, w = img_bgr.shape[:2]
            cy, cx = h // 2, w // 2
            patch = img_bgr[cy-30:cy+30, cx-30:cx+30]
            return patch.reshape(-1, 3)

        x, y, fw, fh = faces[0]
        # Sample forehead (top 20% of face), left cheek, right cheek
        regions = []
        # Forehead
        forehead = img_bgr[y:y + fh // 5, x + fw // 4:x + 3 * fw // 4]
        if forehead.size > 0:
            regions.append(forehead.reshape(-1, 3))
        # Left cheek
        lc = img_bgr[y + fh // 3:y + 2 * fh // 3, x:x + fw // 4]
        if lc.size > 0:
            regions.append(lc.reshape(-1, 3))
        # Right cheek
        rc = img_bgr[y + fh // 3:y + 2 * fh // 3, x + 3 * fw // 4:x + fw]
        if rc.size > 0:
            regions.append(rc.reshape(-1, 3))

        return np.vstack(regions) if regions else np.array([])

    def _analyze_lab(self, skin_pixels_bgr: np.ndarray) -> dict:
        """
        Convert skin pixels to LAB and compute undertone + surface tone.

        LAB Color Space:
          L* = lightness (0-100)
          a* = red-green axis (positive = red, negative = green)
          b* = yellow-blue axis (positive = yellow, negative = blue)

        Undertone logic:
          - Warm: b* > 18 (strong yellow component)
          - Cool: a* > 14 (strong red/pink component, low yellow)
          - Neutral: balanced a* and b*
        """
        if skin_pixels_bgr.size == 0:
            return {'undertone': 'neutral', 'lightness': 50.0, 'surface_tone': 'medium',
                    'lab_values': {'L': 50.0, 'a': 10.0, 'b': 15.0}}

        # Remove outliers using IQR on luminance
        lab_pixels = cv2.cvtColor(
            skin_pixels_bgr.reshape(-1, 1, 3).astype(np.uint8),
            cv2.COLOR_BGR2LAB
        ).reshape(-1, 3).astype(np.float64)

        L_vals = lab_pixels[:, 0]
        q1, q3 = np.percentile(L_vals, [25, 75])
        iqr = q3 - q1
        mask = (L_vals >= q1 - 1.5 * iqr) & (L_vals <= q3 + 1.5 * iqr)
        filtered = lab_pixels[mask]

        if filtered.size == 0:
            filtered = lab_pixels

        # Mean LAB values
        mean_L = float(np.mean(filtered[:, 0]))
        mean_a = float(np.mean(filtered[:, 1]))
        mean_b = float(np.mean(filtered[:, 2]))

        # LAB in OpenCV: L is [0,255] mapped from [0,100], a and b are [0,255] centered at 128
        # Convert to standard LAB range
        L_standard = mean_L * 100.0 / 255.0
        a_standard = mean_a - 128.0
        b_standard = mean_b - 128.0

        # Determine undertone based on the relationship between a* (red/green) and b* (yellow/blue)
        if b_standard > a_standard + 2.5:
            undertone = 'warm'
        elif a_standard > b_standard - 0.5:
            undertone = 'cool'
        else:
            undertone = 'neutral'

        # Determine surface tone from lightness
        if L_standard > 78:
            surface_tone = 'fair'
        elif L_standard > 66:
            surface_tone = 'light'
        elif L_standard > 52:
            surface_tone = 'medium'
        elif L_standard > 38:
            surface_tone = 'tan'
        else:
            surface_tone = 'deep'

        return {
            'undertone': undertone,
            'lightness': round(L_standard, 2),
            'surface_tone': surface_tone,
            'lab_values': {
                'L': round(L_standard, 2),
                'a': round(a_standard, 2),
                'b': round(b_standard, 2),
            },
        }

    def get_recommendations(self, undertone: str, surface_tone: str) -> dict:
        """Get color recommendations based on undertone + surface tone."""
        db = COLOR_DATABASE.get(undertone, COLOR_DATABASE['neutral'])
        colors = db.get(surface_tone, db.get('medium'))
        return {
            'foundation': colors['foundation'],
            'concealer': colors['concealer'],
            'contour': colors['contour'],
            'blush': colors['blush'],
            'lipstick': colors['lipstick'],
            'bindi': colors.get('bindi', ['#CC0000', '#8B0000', '#FFD700', '#FF4500']),
        }

    def analyze_auto(self, b64_image: str) -> dict:
        """
        AUTOMATIC mode: Analyze face image automatically.
        Detects face, samples skin, determines undertone, returns recommendations.
        """
        img_bgr = self.decode_base64_image(b64_image)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # Try MediaPipe first, fallback to Haar cascade
        landmarks = self._get_face_landmarks(img_rgb)
        if landmarks is not None:
            skin_pixels = self._sample_skin_pixels_mediapipe(img_bgr, landmarks)
            detection_method = 'mediapipe'
        else:
            skin_pixels = self._sample_skin_pixels_fallback(img_bgr)
            detection_method = 'haar_cascade'

        analysis = self._analyze_lab(skin_pixels)
        recommendations = self.get_recommendations(
            analysis['undertone'], analysis['surface_tone']
        )

        return {
            'success': True,
            'mode': 'automatic',
            'detection_method': detection_method,
            'undertone': analysis['undertone'],
            'surface_tone': analysis['surface_tone'],
            'lightness': analysis['lightness'],
            'lab_values': analysis['lab_values'],
            'recommendations': recommendations,
        }

    def analyze_manual(self, hex_color: str) -> dict:
        """
        MANUAL mode: User provides a hex color (from skin color picker or swatch).
        Analyzes that specific color to determine undertone + recommendations.
        """
        hex_color = hex_color.strip('#')
        if len(hex_color) != 6:
            raise ValueError(f"Invalid hex color: #{hex_color}")

        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)

        # Create a small pixel array with this color
        pixel = np.array([[[b, g, r]]], dtype=np.uint8)  # OpenCV uses BGR

        analysis = self._analyze_lab(pixel.reshape(-1, 3))
        recommendations = self.get_recommendations(
            analysis['undertone'], analysis['surface_tone']
        )

        return {
            'success': True,
            'mode': 'manual',
            'input_color': f'#{hex_color.upper()}',
            'undertone': analysis['undertone'],
            'surface_tone': analysis['surface_tone'],
            'lightness': analysis['lightness'],
            'lab_values': analysis['lab_values'],
            'recommendations': recommendations,
        }

    def analyze_manual_rgb(self, r: int, g: int, b: int) -> dict:
        """
        MANUAL mode with RGB values (e.g., from eyedropper / pixel picker).
        """
        hex_color = f'{r:02x}{g:02x}{b:02x}'
        return self.analyze_manual(hex_color)


# Singleton instance
analyzer = SkinToneAnalyzer()
