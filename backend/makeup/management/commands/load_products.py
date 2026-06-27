"""Load products from my_content.txt into ScannedProduct database."""
from django.core.management.base import BaseCommand
from makeup.models import ScannedProduct

PRODUCTS = [
    {'product_name': 'Red Shade', 'colour_name': 'red', 'colour_hex': '#123456', 'colour_rgb': 'RGB(1,0,0)'},
    {'product_name': 'Coral Lipstick', 'colour_name': 'coral', 'colour_hex': '#FF7F50', 'colour_rgb': 'RGB(255,127,80)'},
    {'product_name': 'Rose Blush', 'colour_name': 'rose', 'colour_hex': '#FF007F', 'colour_rgb': 'RGB(255,0,127)'},
    {'product_name': 'Nude Foundation', 'colour_name': 'nude', 'colour_hex': '#D4A87A', 'colour_rgb': 'RGB(212,168,122)'},
    {'product_name': 'Berry Lipstick', 'colour_name': 'berry', 'colour_hex': '#8E4585', 'colour_rgb': 'RGB(142,69,133)'},
    {'product_name': 'Peach Blush', 'colour_name': 'peach', 'colour_hex': '#FFCBA4', 'colour_rgb': 'RGB(255,203,164)'},
    {'product_name': 'Maroon Bindi', 'colour_name': 'maroon', 'colour_hex': '#800000', 'colour_rgb': 'RGB(128,0,0)'},
    {'product_name': 'Gold Bindi', 'colour_name': 'gold', 'colour_hex': '#FFD700', 'colour_rgb': 'RGB(255,215,0)'},
]

class Command(BaseCommand):
    help = 'Load default products into database'

    def handle(self, *args, **options):
        created = 0
        for p in PRODUCTS:
            obj, was_created = ScannedProduct.objects.get_or_create(
                product_name=p['product_name'],
                defaults={
                    'barcode_data': f"colour : {p['colour_name']}\ncolour_code : {p['colour_hex']}\nRGB value : {p['colour_rgb']}",
                    'colour_name': p['colour_name'],
                    'colour_hex': p['colour_hex'],
                    'colour_rgb': p['colour_rgb'],
                    'raw_content': f"colour : {p['colour_name']}\ncolour_code : {p['colour_hex']}\nRGB value : {p['colour_rgb']}",
                    'scanned_by': 'system',
                }
            )
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f'Loaded {created} products ({len(PRODUCTS) - created} already existed)'))
