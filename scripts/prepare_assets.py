"""Bundle a correctly attributed 2018 i20 photo once; no runtime network dependency.
The cropped photo remains CC BY-SA 4.0. See assets/ATTRIBUTION.md.
"""
from pathlib import Path
from io import BytesIO
import urllib.request
import time
root = Path(__file__).resolve().parent.parent / 'assets'
root.mkdir(exist_ok=True)
if (root / 'i20-2018.png').exists() and (root / 'icon.png').exists():
    raise SystemExit(0)
from PIL import Image, ImageDraw, ImageFilter
url = 'https://upload.wikimedia.org/wikipedia/commons/7/71/2018_Hyundai_i20_SE_MPi_1.2_Front.jpg'
if not (root / 'i20-2018.png').exists():
    data = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'TachyonDrive/0.2 (personal project; CC BY-SA attribution included)'})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(20_000_001)
            if len(data) > 20_000_000:
                raise ValueError('Image exceeds expected size')
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    image = Image.open(BytesIO(data)).convert('RGBA').resize((2000, 1024), Image.Resampling.LANCZOS)
    outline = [(40,303),(48,263),(65,232),(102,213),(221,177),(270,132),(326,100),(377,71),(475,53),(611,47),(734,55),(827,67),(869,95),(908,151),(931,167),(947,190),(956,254),(960,284),(956,337),(944,385),(921,419),(887,430),(864,424),(848,406),(842,383),(583,416),(568,459),(539,485),(491,494),(461,484),(436,461),(421,441),(209,442),(111,426),(49,407),(38,377),(36,328)]
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).polygon([(x * 2, y * 2) for x, y in outline], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(.7))
    image.putalpha(mask)
    image = image.crop((50, 75, 1940, 1010))
    image.thumbnail((1400, 700), Image.Resampling.LANCZOS)
    image.save(root / 'i20-2018.png', optimize=True)
if not (root / 'icon.png').exists():
    icon = Image.new('RGB', (1024, 1024), '#191A1C')
    draw = ImageDraw.Draw(icon)
    draw.polygon([(210,285),(805,285),(747,391),(582,391),(448,738),(327,738),(461,391),(210,391)], fill='#FF8735')
    draw.line([(695,485),(601,738)], fill='#F4F1EA', width=36)
    icon.save(root / 'icon.png', optimize=True)
print('Offline artwork prepared.')
