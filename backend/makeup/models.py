from django.db import models


class SkinAnalysisResult(models.Model):
    """Stores results of skin tone analysis for user reference."""
    session_id = models.CharField(max_length=64, blank=True, db_index=True)
    user_name = models.CharField(max_length=128, blank=True, default='')
    undertone = models.CharField(max_length=16)
    surface_tone = models.CharField(max_length=16)
    lightness = models.FloatField()
    lab_l = models.FloatField()
    lab_a = models.FloatField()
    lab_b = models.FloatField()
    recommendations = models.JSONField(default=dict)
    mode = models.CharField(max_length=16, default='automatic')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.undertone} / {self.surface_tone} ({self.mode}) - {self.created_at:%Y-%m-%d %H:%M}"


class FavoriteLook(models.Model):
    """Saves a user's favorite makeup look configuration."""
    session_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128, blank=True, default='')
    name = models.CharField(max_length=128, default='My Look')
    foundation_color = models.CharField(max_length=9, blank=True)
    lipstick_color = models.CharField(max_length=9, blank=True)
    blush_color = models.CharField(max_length=9, blank=True)
    contour_color = models.CharField(max_length=9, blank=True)
    bindi_color = models.CharField(max_length=9, blank=True)
    foundation_opacity = models.FloatField(default=0.2)
    lipstick_opacity = models.FloatField(default=0.45)
    blush_opacity = models.FloatField(default=0.3)
    contour_opacity = models.FloatField(default=0.25)
    bindi_opacity = models.FloatField(default=0.8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.created_at:%Y-%m-%d %H:%M}"


class CapturedPhoto(models.Model):
    """Stores captured photos from the AR camera."""
    user_name = models.CharField(max_length=128, db_index=True)
    image = models.ImageField(upload_to='captures/')
    file_path = models.CharField(max_length=512, blank=True)
    notes = models.TextField(blank=True)
    makeup_config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_name} - {self.created_at:%Y-%m-%d %H:%M}"


class ScannedProduct(models.Model):
    """Stores products scanned via barcode."""
    barcode_data = models.CharField(max_length=512, db_index=True)
    product_name = models.CharField(max_length=256, blank=True)
    category = models.CharField(max_length=64, blank=True, default='')
    colour_name = models.CharField(max_length=64, blank=True)
    colour_hex = models.CharField(max_length=9, blank=True)
    colour_rgb = models.CharField(max_length=32, blank=True)
    barcode_image = models.ImageField(upload_to='barcodes/', blank=True, null=True)
    raw_content = models.TextField(blank=True)
    scanned_by = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product_name or self.barcode_data} - {self.colour_name}"
