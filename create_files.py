import os

directory = 'D:/wibe_chat/frontend/public/file-icons'
os.makedirs(directory, exist_ok=True)

file_names = [
    'pdf.png', 'doc.png', 'xls.png', 'ppt.png', 'zip.png', 'txt.png', 'csv.png',
    'audio.png', 'video.png', 'image.png', 'file.png'
]

for f_name in file_names:
    with open(os.path.join(directory, f_name), 'w') as f:
        pass
