import re

with open("c:/Users/jaime/Proyectos/stream/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Change main-wrapper max-width to 450px and center it
content = re.sub(
    r'\.main-wrapper\s*\{\s*width:\s*100%;\s*max-width:\s*600px;',
    r'.main-wrapper {\n            width: 100%;\n            max-width: 450px;\n            margin: 0 auto;',
    content
)

# 2. Remove @media (min-width: 900px) block entirely
content = re.sub(
    r'@media\s*\(min-width:\s*900px\)\s*\{[^}]+\.info-grid\s*\{[^}]+\}\s*\}',
    '',
    content,
    flags=re.DOTALL
)

# 3. Modify player-card to be column and centered
content = re.sub(
    r'(\.player-card\s*\{[^}]*?)flex-direction:\s*row;([^}]*?)text-align:\s*left;',
    r'\1flex-direction: column;\2text-align: center;',
    content,
    flags=re.DOTALL
)

# 4. Modify rx-live-label to center
content = re.sub(
    r'(\.rx-live-label\s*\{[^}]*?)justify-content:\s*flex-start;',
    r'\1justify-content: center;',
    content,
    flags=re.DOTALL
)

# 5. Modify rx-track to center
content = re.sub(
    r'(\.rx-track\s*\{[^}]*?)justify-content:\s*flex-start;',
    r'\1justify-content: center;',
    content,
    flags=re.DOTALL
)

# 6. Center rx-controls
content = re.sub(
    r'(\.rx-controls\s*\{[^}]*?)(width:\s*100%;)',
    r'\1\2\n            justify-content: center;',
    content,
    flags=re.DOTALL
)

# 7. Add base flex column to .info-grid if not already there, replacing the potential missing grid layout
# Let's just find info-grid and make sure it has a default flex layout.
# Wait, let's find the media query (max-width: 600px) and apply its info-grid rule to the main body.
# Actually, I can just append a rule at the end of the style tag to force mobile look.
mobile_overrides = """
        /* -- FORZADO MÓVIL PERMANENTE -- */
        .info-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 2.2rem !important;
        }
        .main-wrapper {
            gap: 2.2rem !important;
        }
        .rx-station-name {
            text-align: center !important;
        }
        .rx-track {
            flex-wrap: nowrap !important;
            justify-content: center !important;
            font-size: 1.15rem !important;
        }
        .rx-controls {
            justify-content: center !important;
            gap: 1rem !important;
        }
"""
content = content.replace("</style>", mobile_overrides + "\n    </style>")

with open("c:/Users/jaime/Proyectos/stream/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated CSS.")
