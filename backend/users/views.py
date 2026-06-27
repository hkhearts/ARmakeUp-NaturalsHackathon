"""Users API — stub endpoints for auth."""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['POST'])
def register(request):
    """Stub: user registration."""
    return Response({
        'success': True,
        'message': 'Registration endpoint (stub). Implement full auth as needed.',
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def login(request):
    """Stub: user login."""
    return Response({
        'success': True,
        'message': 'Login endpoint (stub). Implement full auth as needed.',
    }, status=status.HTTP_200_OK)
