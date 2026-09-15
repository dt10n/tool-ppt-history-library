import csv
from pathlib import Path


SOURCE_DIR = Path('/Users/fanlili/Desktop/范丽丽./图片素材库站点/exports')
OUTPUT_DIR = Path(__file__).resolve().parent.parent / 'sample-data'

IMAGE_PATHS = {
    '0a43831c-24b5-40f6-84ed-f93cec46ded1': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118150328457.jpeg',
    '255ee808-571c-496f-ab89-ae74f91f2f01': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118144968713.jpeg',
    '9d15c522-a581-4599-82f2-b8b7717b287e': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118144968745.jpeg',
    'f33e57da-f84a-44ba-9eb3-a81c1fb5c97a': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118150327577.jpeg',
    '373b32a2-3a4e-404b-acc3-5ae73d8defd8': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118154020985.jpeg',
    '2a19e6f5-42f7-4536-bb4f-d8c45a6facc0': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118144968761.jpeg',
    '677166cd-0517-4955-af00-100e30266f07': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118150327561.jpeg',
    'ccfab3e5-681a-432a-b3b4-64a2731c1b8c': '/spark/app/app_17cjaejyeks/runtime/api/v1/storage/object/bucket_aadkraazexmbw/1874118150327593.jpeg',
}


def read_csv(name: str) -> list[dict[str, str]]:
    with (SOURCE_DIR / name).open(encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def write_csv(name: str, rows: list[dict[str, str]], fields: list[str]) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    with (OUTPUT_DIR / name).open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


pages = []
for row in read_csv('pages.csv'):
    if row['id'] not in IMAGE_PATHS:
        continue
    pages.append({**row, 'image_path': IMAGE_PATHS[row['id']]})

taxonomy = read_csv('taxonomy.csv')
page_tags = [
    row for row in read_csv('page_tags.csv') if row['page_id'] in IMAGE_PATHS
]

write_csv(
    'library_pages.csv',
    pages,
    [
        'id', 'title', 'episode_label', 'page_number', 'source_group',
        'image_key', 'image_path', 'ocr_text', 'search_text', 'source_label',
    ],
)
write_csv(
    'library_taxonomy.csv',
    taxonomy,
    ['path', 'label', 'parent_path', 'depth'],
)
write_csv(
    'library_page_tags.csv',
    page_tags,
    ['page_id', 'tag_path'],
)
