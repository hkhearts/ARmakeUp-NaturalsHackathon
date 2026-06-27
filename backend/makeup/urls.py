from django.urls import path
from . import views

urlpatterns = [
    # Skin analysis
    path('analyze-face/', views.analyze_face_auto, name='analyze-face-auto'),
    path('analyze-manual/', views.analyze_face_manual, name='analyze-face-manual'),

    # Looks
    path('save-look/', views.save_look, name='save-look'),
    path('looks/<str:session_id>/', views.get_looks, name='get-looks'),

    # Color database
    path('color-database/', views.color_database, name='color-database'),

    # Photo capture
    path('capture/', views.capture_photo, name='capture-photo'),

    # Barcode
    path('scan-barcode/', views.scan_barcode, name='scan-barcode'),
    path('scan-barcode-manual/', views.scan_barcode_manual, name='scan-barcode-manual'),
    path('products/', views.list_products, name='list-products'),
    path('products/<int:product_id>/delete/', views.delete_product, name='delete-product'),

    # Database viewer
    path('all-data/', views.all_data, name='all-data'),

    # Report
    path('generate-report/', views.generate_report, name='generate-report'),
]
