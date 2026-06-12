from PIL import Image

def trim_dragon():
    img = Image.open('assets/dragon_head.png')
    # Find bounding box of non-transparent pixels (alpha > 0)
    bbox = img.getbbox()
    if bbox:
        trimmed = img.crop(bbox)
        trimmed.save('assets/dragon_head.png', 'PNG')
        print(f"Trimmed dragon head saved. New size: {trimmed.size}")
    else:
        print("No non-transparent pixels found!")

if __name__ == '__main__':
    trim_dragon()
