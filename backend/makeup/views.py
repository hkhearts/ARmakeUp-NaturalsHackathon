"""
Makeup API Views
================
POST /api/analyze-face/          - Automatic skin tone analysis from image
POST /api/analyze-manual/        - Manual skin tone analysis from hex/RGB
POST /api/save-look/             - Save a favorite makeup look
GET  /api/looks/<session_id>/    - Retrieve saved looks
GET  /api/color-database/        - Full color recommendation database
POST /api/capture/               - Save captured photo to user folder
POST /api/scan-barcode/          - Scan barcode and store product data
GET  /api/products/              - List all scanned products
GET  /api/all-data/              - All database records for the UI viewer
POST /api/generate-report/       - Generate a report with screenshot
"""

import base64
import uuid
import os
import re
import json
from io import BytesIO
from datetime import datetime

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .analyzer import analyzer, COLOR_DATABASE
from .serializers import AutoAnalyzeSerializer, ManualAnalyzeSerializer, SaveLookSerializer
from .models import SkinAnalysisResult, FavoriteLook, CapturedPhoto, ScannedProduct


@csrf_exempt
@api_view(['POST'])
def analyze_face_auto(request):
    """Automatic analysis: base64 image -> undertone + recommendations."""
    serializer = AutoAnalyzeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'success': False, 'errors': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        result = analyzer.analyze_auto(serializer.validated_data['image'])
        SkinAnalysisResult.objects.create(
            session_id=request.data.get('session_id', str(uuid.uuid4())[:8]),
            user_name=request.data.get('user_name', ''),
            undertone=result['undertone'],
            surface_tone=result['surface_tone'],
            lightness=result['lightness'],
            lab_l=result['lab_values']['L'],
            lab_a=result['lab_values']['a'],
            lab_b=result['lab_values']['b'],
            recommendations=result['recommendations'],
            mode='automatic',
        )
        return Response(result, status=status.HTTP_200_OK)
    except ValueError as e:
        return Response({'success': False, 'error': str(e)},
                        status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'success': False, 'error': f'Analysis failed: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(['POST'])
def analyze_face_manual(request):
    """Manual analysis: hex color or RGB -> undertone + recommendations."""
    serializer = ManualAnalyzeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'success': False, 'errors': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        data = serializer.validated_data
        if data.get('hex_color'):
            result = analyzer.analyze_manual(data['hex_color'])
        else:
            result = analyzer.analyze_manual_rgb(data['r'], data['g'], data['b'])

        SkinAnalysisResult.objects.create(
            session_id=request.data.get('session_id', str(uuid.uuid4())[:8]),
            user_name=request.data.get('user_name', ''),
            undertone=result['undertone'],
            surface_tone=result['surface_tone'],
            lightness=result['lightness'],
            lab_l=result['lab_values']['L'],
            lab_a=result['lab_values']['a'],
            lab_b=result['lab_values']['b'],
            recommendations=result['recommendations'],
            mode='manual',
        )
        return Response(result, status=status.HTTP_200_OK)
    except ValueError as e:
        return Response({'success': False, 'error': str(e)},
                        status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'success': False, 'error': f'Analysis failed: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(['POST'])
def save_look(request):
    """Save a favorite makeup look."""
    serializer = SaveLookSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'success': False, 'errors': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data
    session_id = request.data.get('session_id', str(uuid.uuid4())[:8])
    look = FavoriteLook.objects.create(session_id=session_id, **data)
    return Response({'success': True, 'look_id': look.id,
                     'message': f'Look "{look.name}" saved.'}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_looks(request, session_id):
    """Retrieve saved looks for a session."""
    looks = FavoriteLook.objects.filter(session_id=session_id).values()
    return Response({'success': True, 'looks': list(looks)})


@api_view(['GET'])
def color_database(request):
    """Return the full color recommendation database."""
    return Response({'success': True, 'database': COLOR_DATABASE})


# -------------------------------------------------------------------
# CAPTURE PHOTOS — Save to per-user folder
# -------------------------------------------------------------------

@csrf_exempt
@api_view(['POST'])
def capture_photo(request):
    """
    Save a captured screenshot to the user's folder.
    Input: { user_name: "string", image: "base64...", notes: "", makeup_config: {} }
    """
    user_name = request.data.get('user_name', '').strip()
    if not user_name:
        return Response({'success': False, 'error': 'user_name is required'},
                        status=status.HTTP_400_BAD_REQUEST)

    image_b64 = request.data.get('image', '')
    if not image_b64:
        return Response({'success': False, 'error': 'image is required'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Strip data URI prefix
    if ',' in image_b64:
        image_b64 = image_b64.split(',', 1)[1]

    # Create user folder
    safe_name = re.sub(r'[^\w\s-]', '', user_name).strip().replace(' ', '_')
    user_dir = os.path.join(settings.MEDIA_ROOT, 'captures', safe_name)
    os.makedirs(user_dir, exist_ok=True)

    # Save image
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'capture_{timestamp}.png'
    filepath = os.path.join(user_dir, filename)

    img_bytes = base64.b64decode(image_b64)
    with open(filepath, 'wb') as f:
        f.write(img_bytes)

    # Save to database
    relative_path = os.path.join('captures', safe_name, filename)
    photo = CapturedPhoto.objects.create(
        user_name=user_name,
        image=relative_path,
        file_path=filepath,
        notes=request.data.get('notes', ''),
        makeup_config=request.data.get('makeup_config', {}),
    )

    return Response({
        'success': True,
        'photo_id': photo.id,
        'file_path': relative_path,
        'message': f'Photo saved to {safe_name}/{filename}',
    }, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------------
# BARCODE SCANNING — Decode, parse color, store product
# -------------------------------------------------------------------

def _parse_barcode_content(raw_text):
    """
    Parse barcode content text (my_content.txt format) to extract color info.
    Format:
      colour : red
      colour_code : #123456
      RGB value : RGB(1,0,0)
    """
    result = {'colour_name': '', 'colour_hex': '', 'colour_rgb': '', 'product_name': '', 'category': ''}

    for line in raw_text.strip().split('\n'):
        line = line.strip()
        if ':' in line:
            key, val = line.split(':', 1)
            key = key.strip().lower()
            val = val.strip()

            if key in ('colour', 'color'):
                result['colour_name'] = val
            elif key in ('colour_code', 'color_code', 'hex'):
                result['colour_hex'] = val
            elif key.startswith('rgb'):
                result['colour_rgb'] = val
                # Parse RGB(r,g,b) to hex if no hex provided
                rgb_match = re.search(r'RGB\((\d+),\s*(\d+),\s*(\d+)\)', val, re.IGNORECASE)
                if rgb_match and not result['colour_hex']:
                    r, g, b = int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3))
                    result['colour_hex'] = f'#{r:02x}{g:02x}{b:02x}'
            elif key in ('product', 'product_name', 'name'):
                result['product_name'] = val
            elif key in ('category', 'type', 'makeup'):
                result['category'] = val

    # If no product name extracted, use colour name
    if not result['product_name'] and result['colour_name']:
        result['product_name'] = f'{result["colour_name"]} product'

    return result


@csrf_exempt
@api_view(['POST'])
def scan_barcode(request):
    """
    Scan a barcode image and store the product data.
    Input: { barcode_image: "base64...", user_name: "" }
    The barcode encodes text content in my_content.txt format.
    """
    barcode_b64 = request.data.get('barcode_image', '')
    if not barcode_b64:
        return Response({'success': False, 'error': 'barcode_image is required'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Strip data URI prefix
    if ',' in barcode_b64:
        barcode_b64 = barcode_b64.split(',', 1)[1]

    try:
        # Decode image
        img_bytes = base64.b64decode(barcode_b64)

        # Try to decode barcode using pyzbar
        try:
            from pyzbar.pyzbar import decode as pyzbar_decode
            from PIL import Image
            img = Image.open(BytesIO(img_bytes))
            decoded_objects = pyzbar_decode(img)

            if decoded_objects:
                barcode_data = decoded_objects[0].data.decode('utf-8')
            else:
                # If pyzbar can't decode, treat the raw data as content
                barcode_data = request.data.get('manual_content', '')
                if not barcode_data:
                    return Response({'success': False, 'error': 'No barcode detected in image'},
                                    status=status.HTTP_400_BAD_REQUEST)
        except ImportError:
            # pyzbar not installed, use manual content
            barcode_data = request.data.get('manual_content', '')
            if not barcode_data:
                return Response({'success': False, 'error': 'pyzbar not installed. Provide manual_content.'},
                                status=status.HTTP_400_BAD_REQUEST)

        # Parse the barcode content
        parsed = _parse_barcode_content(barcode_data)

        # Save barcode image
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        barcode_filename = f'barcode_{timestamp}.png'
        barcode_dir = os.path.join(settings.MEDIA_ROOT, 'barcodes')
        os.makedirs(barcode_dir, exist_ok=True)
        barcode_path = os.path.join(barcode_dir, barcode_filename)

        with open(barcode_path, 'wb') as f:
            f.write(img_bytes)

        # Store in database
        product = ScannedProduct.objects.create(
            barcode_data=barcode_data,
            product_name=parsed['product_name'],
            category=request.data.get('category', parsed['category']),
            colour_name=parsed['colour_name'],
            colour_hex=parsed['colour_hex'],
            colour_rgb=parsed['colour_rgb'],
            barcode_image=f'barcodes/{barcode_filename}',
            raw_content=barcode_data,
            scanned_by=request.data.get('user_name', ''),
        )

        return Response({
            'success': True,
            'product_id': product.id,
            'barcode_data': barcode_data,
            'product_name': parsed['product_name'],
            'category': request.data.get('category', parsed['category']),
            'colour_name': parsed['colour_name'],
            'colour_hex': parsed['colour_hex'],
            'colour_rgb': parsed['colour_rgb'],
            'message': f'Product "{parsed["product_name"]}" scanned and saved.',
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'success': False, 'error': f'Barcode scan failed: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(['POST'])
def scan_barcode_manual(request):
    """
    Manual barcode entry: paste the text content directly.
    Input: { content: "colour : red\ncolour_code : #123456\nRGB value : RGB(1,0,0)", user_name: "" }
    """
    content = request.data.get('content', '').strip()
    if not content:
        return Response({'success': False, 'error': 'content is required'},
                        status=status.HTTP_400_BAD_REQUEST)

    parsed = _parse_barcode_content(content)

    product = ScannedProduct.objects.create(
        barcode_data=content[:256],
        product_name=parsed['product_name'] or 'Manual Entry',
        category=request.data.get('category', parsed['category']),
        colour_name=parsed['colour_name'],
        colour_hex=parsed['colour_hex'],
        colour_rgb=parsed['colour_rgb'],
        raw_content=content,
        scanned_by=request.data.get('user_name', ''),
    )

    return Response({
        'success': True,
        'product_id': product.id,
        'product_name': parsed['product_name'],
        'category': request.data.get('category', parsed['category']),
        'colour_name': parsed['colour_name'],
        'colour_hex': parsed['colour_hex'],
        'colour_rgb': parsed['colour_rgb'],
    }, status=status.HTTP_201_CREATED)

@csrf_exempt
@api_view(['POST', 'DELETE'])
def delete_product(request, product_id):
    """Delete a scanned product."""
    try:
        product = ScannedProduct.objects.get(id=product_id)
        product.delete()
        return Response({'success': True, 'message': 'Product deleted successfully.'})
    except ScannedProduct.DoesNotExist:
        return Response({'success': False, 'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def list_products(request):
    """List all scanned products."""
    products = ScannedProduct.objects.all().values(
        'id', 'barcode_data', 'product_name', 'category', 'colour_name', 'colour_hex',
        'colour_rgb', 'barcode_image', 'scanned_by', 'created_at'
    )
    return Response({'success': True, 'products': list(products)})


# -------------------------------------------------------------------
# DATABASE VIEWER — All records
# -------------------------------------------------------------------

@api_view(['GET'])
def all_data(request):
    """Return all database records for the database viewer UI."""
    analyses = list(SkinAnalysisResult.objects.all().values(
        'id', 'user_name', 'undertone', 'surface_tone', 'lightness',
        'lab_l', 'lab_a', 'lab_b', 'mode', 'created_at'
    ))
    looks = list(FavoriteLook.objects.all().values())
    photos = list(CapturedPhoto.objects.all().values(
        'id', 'user_name', 'image', 'notes', 'created_at'
    ))
    products = list(ScannedProduct.objects.all().values(
        'id', 'barcode_data', 'product_name', 'category', 'colour_name', 'colour_hex',
        'colour_rgb', 'barcode_image', 'scanned_by', 'created_at'
    ))

    return Response({
        'success': True,
        'analyses': analyses,
        'looks': looks,
        'photos': photos,
        'products': products,
    })


# -------------------------------------------------------------------
# REPORT GENERATION
# -------------------------------------------------------------------

@csrf_exempt
@api_view(['POST'])
def generate_report(request):
    """
    Generate a report with analysis details.
    Input: { image: "base64...", user_name: "", analysis: {} }
    Returns report data (no emojis).
    """
    user_name = request.data.get('user_name', 'Guest')
    analysis = request.data.get('analysis', {})
    image_b64 = request.data.get('image', '')
    makeup_config = request.data.get('makeup_config', {})

    # Save report image if provided
    report_image_path = ''
    if image_b64:
        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]

        safe_name = re.sub(r'[^\w\s-]', '', user_name).strip().replace(' ', '_')
        report_dir = os.path.join(settings.MEDIA_ROOT, 'captures', safe_name, 'reports')
        os.makedirs(report_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'report_{timestamp}.png'
        filepath = os.path.join(report_dir, filename)

        img_bytes = base64.b64decode(image_b64)
        with open(filepath, 'wb') as f:
            f.write(img_bytes)

        report_image_path = f'/media/captures/{safe_name}/reports/{filename}'

    report = {
        'success': True,
        'report': {
            'title': 'Skin Analysis Report',
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'user_name': user_name,
            'analysis': {
                'undertone': analysis.get('undertone', 'N/A'),
                'surface_tone': analysis.get('surface_tone', 'N/A'),
                'lightness': analysis.get('lightness', 'N/A'),
                'detection_mode': analysis.get('mode', 'N/A'),
                'lab_values': analysis.get('lab_values', {}),
            },
            'recommendations': analysis.get('recommendations', {}),
            'makeup_applied': makeup_config,
            'screenshot_url': report_image_path,
        },
    }

    return Response(report, status=status.HTTP_200_OK)
