#!/usr/bin/env python3
"""Generate PWA icons for Order Tracker app."""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create an icon with a package/box design."""
    # Create image with dark background
    img = Image.new('RGBA', (size, size), (15, 15, 26, 255))
    draw = ImageDraw.Draw(img)

    # Calculate dimensions
    center = size // 2
    padding = size // 8
    box_size = size - (padding * 2)

    # Draw gradient-like background circle
    circle_radius = size // 2 - padding // 2
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        fill=(99, 102, 241, 255)  # Accent color
    )

    # Draw package box icon
    box_width = int(box_size * 0.55)
    box_height = int(box_size * 0.45)
    box_left = center - box_width // 2
    box_top = center - box_height // 2 + size // 20

    # Main box body
    draw.rectangle(
        [box_left, box_top, box_left + box_width, box_top + box_height],
        fill=(255, 255, 255, 255),
        outline=(220, 220, 240, 255),
        width=max(1, size // 100)
    )

    # Box flap (top triangle/fold effect)
    flap_height = box_height // 3
    flap_points = [
        (box_left, box_top),
        (center, box_top - flap_height),
        (box_left + box_width, box_top)
    ]
    draw.polygon(flap_points, fill=(240, 240, 255, 255))

    # Box tape/center line
    tape_width = box_width // 6
    draw.rectangle(
        [center - tape_width // 2, box_top - flap_height + size // 40,
         center + tape_width // 2, box_top + box_height],
        fill=(255, 152, 0, 255)  # Orange tape
    )

    # Checkmark for "tracked"
    check_size = size // 6
    check_x = center + box_width // 3
    check_y = box_top + box_height - check_size // 2

    # Draw checkmark circle
    draw.ellipse(
        [check_x - check_size // 2, check_y - check_size // 2,
         check_x + check_size // 2, check_y + check_size // 2],
        fill=(76, 175, 80, 255)  # Green
    )

    # Draw checkmark
    check_width = max(2, size // 50)
    check_points = [
        (check_x - check_size // 4, check_y),
        (check_x - check_size // 10, check_y + check_size // 4),
        (check_x + check_size // 3, check_y - check_size // 4)
    ]
    draw.line(check_points[:2], fill=(255, 255, 255, 255), width=check_width)
    draw.line(check_points[1:], fill=(255, 255, 255, 255), width=check_width)

    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Create icons
    create_icon(192, os.path.join(script_dir, 'icon-192.png'))
    create_icon(512, os.path.join(script_dir, 'icon-512.png'))

    print("Icons generated successfully!")

if __name__ == '__main__':
    main()
