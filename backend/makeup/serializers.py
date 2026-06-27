from rest_framework import serializers


class AutoAnalyzeSerializer(serializers.Serializer):
    """Validates input for automatic face analysis."""
    image = serializers.CharField(help_text="Base64-encoded image (with or without data URI prefix)")


class ManualAnalyzeSerializer(serializers.Serializer):
    """Validates input for manual color analysis."""
    hex_color = serializers.CharField(
        max_length=9,
        required=False,
        help_text="Hex color string, e.g. '#D4A87A' or 'D4A87A'"
    )
    r = serializers.IntegerField(min_value=0, max_value=255, required=False)
    g = serializers.IntegerField(min_value=0, max_value=255, required=False)
    b = serializers.IntegerField(min_value=0, max_value=255, required=False)

    def validate(self, data):
        has_hex = 'hex_color' in data and data['hex_color']
        has_rgb = all(k in data for k in ('r', 'g', 'b'))
        if not has_hex and not has_rgb:
            raise serializers.ValidationError(
                "Provide either 'hex_color' or all of 'r', 'g', 'b'."
            )
        return data


class SaveLookSerializer(serializers.Serializer):
    """Validates input for saving a favorite look."""
    name = serializers.CharField(max_length=128, default='My Look')
    foundation_color = serializers.CharField(max_length=9, required=False, default='')
    lipstick_color = serializers.CharField(max_length=9, required=False, default='')
    blush_color = serializers.CharField(max_length=9, required=False, default='')
    contour_color = serializers.CharField(max_length=9, required=False, default='')
    foundation_opacity = serializers.FloatField(min_value=0, max_value=1, default=0.2)
    lipstick_opacity = serializers.FloatField(min_value=0, max_value=1, default=0.45)
    blush_opacity = serializers.FloatField(min_value=0, max_value=1, default=0.3)
    contour_opacity = serializers.FloatField(min_value=0, max_value=1, default=0.25)
