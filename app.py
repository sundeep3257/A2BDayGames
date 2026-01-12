import os
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)
# Use environment variable for secret key in production, fallback for development
app.secret_key = os.environ.get('SECRET_KEY', 'a2bdaygames-secret-key-change-in-production')

# Valid characters
VALID_CHARACTERS = ['Armando', 'Ananya']
VALID_GAMES = ['snake', 'pacman', 'pinball', 'asteroids', 'brickbreaker', 'runner']


@app.route('/')
def index():
    """Homepage with character and game selection"""
    return render_template('index.html')


@app.route('/play', methods=['POST'])
def play():
    """Handle character and game selection, redirect to game"""
    character = request.form.get('character')
    game = request.form.get('game')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    # Validate game
    if game not in VALID_GAMES:
        return redirect(url_for('index'))
    
    # Redirect to appropriate game
    if game == 'snake':
        return redirect(url_for('snake', character=character))
    elif game == 'pacman':
        return redirect(url_for('pacman', character=character))
    elif game == 'pinball':
        return redirect(url_for('pinball', character=character))
    elif game == 'asteroids':
        return redirect(url_for('asteroids', character=character))
    elif game == 'brickbreaker':
        return redirect(url_for('brickbreaker', character=character))
    elif game == 'runner':
        return redirect(url_for('runner', character=character))
    else:
        # Placeholder games
        return redirect(url_for('placeholder', name=game))


@app.route('/snake')
def snake():
    """Snake game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('snake.html', character=character)


@app.route('/pacman')
def pacman():
    """Pac-Man game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('pacman.html', character=character)


@app.route('/pinball')
def pinball():
    """Pinball game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('pinball.html', character=character)


@app.route('/asteroids')
def asteroids():
    """Asteroids game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('asteroids.html', character=character)


@app.route('/brickbreaker')
def brickbreaker():
    """Brick Breaker game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('brickbreaker.html', character=character)


@app.route('/runner')
def runner():
    """Runner game page"""
    character = request.args.get('character', 'Armando')
    
    # Validate character
    if character not in VALID_CHARACTERS:
        return redirect(url_for('index'))
    
    return render_template('runner.html', character=character)


@app.route('/games/<name>')
def placeholder(name):
    """Placeholder page for games not yet implemented"""
    return render_template('placeholders.html', game_name=name)


if __name__ == '__main__':
    # Only run in debug mode if not in production
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
