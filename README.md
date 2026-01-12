# A² Birthday Games

A Flask web application hosting mini-games with character-based gameplay.

## Setup Instructions

### 1. Create a Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Application

```bash
flask run
```

Or with Python directly:

```bash
python app.py
```

The app will be available at `http://127.0.0.1:5000` or `http://localhost:5000`

## Project Structure

```
a2bdaygames/
├── app.py                 # Flask application with routes
├── requirements.txt       # Python dependencies
├── templates/
│   ├── base.html         # Base template with A² branding
│   ├── index.html        # Homepage with character/game selection
│   ├── snake.html        # Snake game page
│   └── placeholders.html # Placeholder for future games
├── static/
│   ├── css/
│   │   └── styles.css    # Retro-punk pastel styling
│   ├── js/
│   │   └── snake.js      # Snake game logic
│   └── graphics/
│       ├── Armando_head.png
│       └── Ananya_head.png
└── README.md
```

## Features

- **Character Selection**: Choose between Armando and Ananya
- **Snake Game**: Classic Snake with character-based sprites
  - Snake head uses selected character image
  - Food uses opposite character image
  - Mobile-friendly D-pad controls
  - Keyboard controls (Arrow keys + WASD)
  - Responsive canvas that scales to screen size

## Game Controls

- **Mobile**: On-screen D-pad buttons
- **Desktop**: Arrow keys or WASD keys
- **Restart**: Tap/click the game over overlay

## Development Notes

- The app uses Flask with Jinja2 templates
- Snake game runs fully client-side using HTML5 Canvas
- Character selection is stored in sessionStorage
- Images must be placed in `static/graphics/` directory
