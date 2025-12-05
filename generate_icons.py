#!/usr/bin/env python3
"""Generate calendar app icons"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a calendar icon with the number 3"""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Draw gradient-like effect (simplified)
    for i in range(size):
        color_value = int(102 + (i / size) * (118 - 102))  # Gradient from #667eea to #764ba2
        draw.line([(0, i), (size, i)], fill=(color_value, 75, 170))

    # Calendar dimensions
    padding = int(size * 0.15)
    cal_width = size - (padding * 2)
    cal_height = size - (padding * 2)
    cal_x = padding
    cal_y = padding

    # Draw white rounded rectangle for calendar
    draw.rounded_rectangle(
        [(cal_x, cal_y), (cal_x + cal_width, cal_y + cal_height)],
        radius=int(size * 0.05),
        fill='white'
    )

    # Draw header (purple)
    header_height = int(cal_height * 0.25)
    draw.rounded_rectangle(
        [(cal_x, cal_y), (cal_x + cal_width, cal_y + header_height)],
        radius=int(size * 0.05),
        fill='#667eea'
    )

    # Draw binding rings
    ring_radius = int(size * 0.03)
    ring_y = cal_y + header_height // 2
    for i in range(1, 4):
        ring_x = cal_x + (cal_width // 4) * i
        draw.ellipse(
            [(ring_x - ring_radius, ring_y - ring_radius),
             (ring_x + ring_radius, ring_y + ring_radius)],
            fill='white'
        )

    # Draw the number "3"
    font_size = int(size * 0.35)
    try:
        # Try to use a nice font
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            # Fallback to default
            font = ImageFont.load_default()

    text = "3"
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    text_x = cal_x + (cal_width - text_width) // 2
    text_y = cal_y + header_height + ((cal_height - header_height) - text_height) // 2

    draw.text((text_x, text_y), text, fill='#667eea', font=font)

    # Save image
    img.save(filename, 'PNG')
    print(f"Created {filename}")

if __name__ == '__main__':
    # Create both icon sizes
    create_icon(192, 'icon-192.png')
    create_icon(512, 'icon-512.png')
    print("Icons created successfully!")
