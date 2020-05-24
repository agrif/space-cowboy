import os.path
import sys
import gzip
import urllib.request
import contextlib
import csv
import math
import json

HYG_URL = 'http://www.astronexus.com/files/downloads/hygfull.csv.gz'
HYG_LOCAL = 'hyg-stars-v1.1.csv.gz'
OUTPUT = 'stars.json'

@contextlib.contextmanager
def open_hyg():
    base = os.path.split(sys.argv[0])[0]
    fname = os.path.join(base, HYG_LOCAL)
    if not os.path.exists(fname):
        urllib.request.urlretrieve(HYG_URL, fname)
    with gzip.open(fname, 'rt') as f:
        r = csv.DictReader(f)
        yield r
    

def main():
    stars = []
    with open_hyg() as f:
        for row in f:
            ra = float(row['RA'].strip())
            dec = float(row['Dec'].strip())
            dist = float(row['Distance'].strip())
            try:
                mag = float(row['Mag'].strip())
                color = float(row['ColorIndex'].strip())
            except ValueError:
                continue

            if mag > 6.5:
                # not visible to naked eye
                continue

            theta = ra * 2 * math.pi / 24
            phi = dec * math.pi / 180

            x = math.cos(phi) * math.cos(theta)
            y = math.cos(phi) * math.sin(theta)
            z = math.sin(phi)

            stars.append(dict(
                x = x,
                y = y,
                z = z,
                mag = mag,
                color = color,
            ))
    stars.sort(key=lambda s: s['mag'])
    print('found {} visible stars'.format(len(stars)))
    with open(OUTPUT, 'w') as f:
        json.dump(stars, f)

if __name__ == '__main__':
    main()
