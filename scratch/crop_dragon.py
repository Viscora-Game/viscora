from PIL import Image, ImageOps

def crop_and_transparent():
    img = Image.open('assets/flamethrower.png').convert('RGBA')
    width, height = img.size
    
    # We crop the dragon head area. 
    # Based on visual analysis:
    # X from 50 to 215, Y from 100 to 420.
    # Let's inspect the bounding box of non-black pixels in this region.
    crop_box = (50, 100, 215, 420)
    cropped = img.crop(crop_box)
    
    # Make black background transparent
    datas = cropped.getdata()
    newData = []
    for item in datas:
        # Check if pixel is close to black
        # Calculate perceived brightness or just RGB distance
        r, g, b, a = item
        brightness = (r + g + b) / 3.0
        
        if brightness < 15:
            # Fully transparent
            newData.append((0, 0, 0, 0))
        elif brightness < 45:
            # Semi-transparent transition to avoid jagged edges
            alpha = int((brightness - 15) / 30.0 * 255)
            newData.append((r, g, b, alpha))
        else:
            newData.append((r, g, b, 255))
            
    cropped.putdata(newData)
    cropped.save('assets/dragon_head.png', 'PNG')
    print("Dragon head saved to assets/dragon_head.png")

if __name__ == '__main__':
    crop_and_transparent()
