import os
import barcode
from barcode.writer import ImageWriter
from pyzbar.pyzbar import decode
from PIL import Image

def generate_barcode(input_txt_file, output_image_name="barcode_output"):
    """Reads text from a file and generates a Code 128 barcode."""
    try:
        # Read the content from the provided text file
        with open(input_txt_file, 'r') as file:
            data = file.read().strip()
            
        if not data:
            print("The text file is empty. Cannot generate a barcode.")
            return None

        # We use Code128 because it easily supports alphanumeric strings
        # ImageWriter saves the barcode as an image file (PNG)
        my_barcode = barcode.Code128(data, writer=ImageWriter())
        
        # This will automatically append .png to the output_image_name
        saved_filename = my_barcode.save(output_image_name)
        print(f"[SUCCESS] Barcode generated and saved as: {saved_filename}")
        return saved_filename
        
    except FileNotFoundError:
        print(f"[ERROR] The file '{input_txt_file}' was not found.")
        return None
    except Exception as e:
        print(f"[ERROR] An error occurred while generating: {e}")
        return None

def read_barcode(image_path):
    """Reads a barcode from an image file and prints the decoded text."""
    try:
        # Load the image using Pillow
        img = Image.open(image_path)
        
        # Decode the barcode using pyzbar
        decoded_objects = decode(img)
        
        if not decoded_objects:
            print(f"[WARNING] No barcode found in '{image_path}'.")
            return
            
        for obj in decoded_objects:
            barcode_type = obj.type
            # The data is returned as bytes, so we decode it to a UTF-8 string
            barcode_data = obj.data.decode('utf-8') 
            print(f"[SUCCESS] Barcode Detected!")
            print(f"  -> Type: {barcode_type}")
            print(f"  -> Data: {barcode_data}")
            
    except FileNotFoundError:
        print(f"[ERROR] The image file '{image_path}' was not found.")
    except Exception as e:
        print(f"[ERROR] An error occurred while reading: {e}")

if __name__ == "__main__":
    # Define your file names here
    text_file = "my_content.txt"
    output_name = "my_generated_barcode"
    
    # 1. Setup: Ensure the text file exists 
    # (If you already have a text file, you can comment this block out)
    if not os.path.exists(text_file):
        print(f"Creating a sample text file named '{text_file}'...")
        with open(text_file, "w") as f:
            f.write("InventoryItem-A1B2C3")
    
    # 2. Generate the Barcode
    print("\n--- BARCODE GENERATOR ---")
    image_file = generate_barcode(text_file, output_name)
    
    # 3. Read the Barcode
    if image_file:
        print("\n--- BARCODE READER ---")
        read_barcode(image_file)