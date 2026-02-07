#!/usr/bin/env python3
"""
Script to scrape MLB player data from ESPN roster pages.
Extracts player names and positions from all 30 MLB teams.
"""

import re
import csv
import json
from pathlib import Path
from typing import List, Dict, Tuple

# MLB Teams with their ESPN abbreviations and URLs
MLB_TEAMS = [
    ("Arizona Diamondbacks", "ari", "arizona-diamondbacks"),
    ("Atlanta Braves", "atl", "atlanta-braves"),
    ("Baltimore Orioles", "bal", "baltimore-orioles"),
    ("Boston Red Sox", "bos", "boston-red-sox"),
    ("Chicago Cubs", "chc", "chicago-cubs"),
    ("Chicago White Sox", "cws", "chicago-white-sox"),
    ("Cincinnati Reds", "cin", "cincinnati-reds"),
    ("Cleveland Guardians", "cle", "cleveland-guardians"),
    ("Colorado Rockies", "col", "colorado-rockies"),
    ("Detroit Tigers", "det", "detroit-tigers"),
    ("Houston Astros", "hou", "houston-astros"),
    ("Kansas City Royals", "kc", "kansas-city-royals"),
    ("Los Angeles Angels", "laa", "los-angeles-angels"),
    ("Los Angeles Dodgers", "lad", "los-angeles-dodgers"),
    ("Miami Marlins", "mia", "miami-marlins"),
    ("Milwaukee Brewers", "mil", "milwaukee-brewers"),
    ("Minnesota Twins", "min", "minnesota-twins"),
    ("New York Mets", "nym", "new-york-mets"),
    ("New York Yankees", "nyy", "new-york-yankees"),
    ("Oakland Athletics", "oak", "oakland-athletics"),
    ("Philadelphia Phillies", "phi", "philadelphia-phillies"),
    ("Pittsburgh Pirates", "pit", "pittsburgh-pirates"),
    ("San Diego Padres", "sd", "san-diego-padres"),
    ("San Francisco Giants", "sf", "san-francisco-giants"),
    ("Seattle Mariners", "sea", "seattle-mariners"),
    ("St. Louis Cardinals", "stl", "st-louis-cardinals"),
    ("Tampa Bay Rays", "tb", "tampa-bay-rays"),
    ("Texas Rangers", "tex", "texas-rangers"),
    ("Toronto Blue Jays", "tor", "toronto-blue-jays"),
    ("Washington Nationals", "was", "washington-nationals"),
]

def parse_player_row(row_text: str) -> Tuple[str, str]:
    """
    Parse a player row from ESPN roster page.
    Format: "Name Number Position Batting Throwing Age Height Weight Birth Place"
    Example: "Keegan Akin 45 RP L L 30 6' 0\" 240 lb Alma, MI"
    Returns: (player_name, position)
    """
    # Remove extra spaces and normalize
    row_text = ' '.join(row_text.split())
    
    # Pattern: Name (words) Number (digits) Position (2-3 letters) ...
    # Position codes: SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF, OF, DH, P
    pattern = r'^(.+?)\s+(\d+)\s+([A-Z]{1,3}|[A-Z]{1,2}[0-9]?)\s+'
    
    match = re.match(pattern, row_text)
    if match:
        name = match.group(1).strip()
        position = match.group(3).strip()
        return (name, position)
    
    # Fallback: try to find position after number
    # Look for common position abbreviations
    position_pattern = r'\s+(\d+)\s+([A-Z]{1,3}|[A-Z]{1,2}[0-9]?)\s+'
    match = re.search(position_pattern, row_text)
    if match:
        # Extract name before the number
        name_part = row_text[:match.start()].strip()
        position = match.group(2).strip()
        return (name_part, position)
    
    return (None, None)

def extract_players_from_snapshot(snapshot_file: Path) -> List[Dict[str, str]]:
    """
    Extract player data from a browser snapshot file.
    """
    players = []
    
    try:
        with open(snapshot_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Find all player rows (rows with name attribute containing player info)
        # Pattern: name: "Player Name Number Position ..."
        row_pattern = r'name:\s+"([^"]+)"'
        matches = re.findall(row_pattern, content)
        
        for match in matches:
            # Skip header rows
            if 'Name POS BAT THW' in match or 'Name POS' in match:
                continue
            
            # Check if it looks like a player row (has position code)
            position_codes = ['SP', 'RP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'P']
            has_position = any(code in match for code in position_codes)
            
            if has_position and any(char.isdigit() for char in match):
                name, position = parse_player_row(match)
                if name and position:
                    players.append({
                        'name': name,
                        'position': position
                    })
    
    except Exception as e:
        print(f"Error reading snapshot {snapshot_file}: {e}")
    
    return players

def main():
    """
    Main function to scrape all MLB teams and create CSV.
    This script expects snapshot files to be created by browser automation.
    For now, it provides a template that can be used with browser tools.
    """
    all_players = []
    
    print("MLB Player Scraper")
    print("=" * 50)
    print("\nThis script will help extract player data from ESPN roster pages.")
    print("You'll need to navigate to each team's roster page using the browser tools.")
    print("\nTeam roster URLs follow this pattern:")
    print("https://www.espn.com/mlb/team/roster/_/name/{abbrev}/{team-name}")
    print("\nTeams to process:")
    for i, (team_name, abbrev, url_name) in enumerate(MLB_TEAMS, 1):
        url = f"https://www.espn.com/mlb/team/roster/_/name/{abbrev}/{url_name}"
        print(f"{i:2d}. {team_name:30s} - {url}")
    
    print("\n" + "=" * 50)
    print("To complete the scraping:")
    print("1. Use browser tools to navigate to each team's roster page")
    print("2. Take a snapshot of each page")
    print("3. Run this script to parse the snapshot files")
    print("\nAlternatively, you can manually extract data from the browser snapshots.")
    
    # Check for existing snapshot files
    snapshot_dir = Path.home() / ".cursor" / "browser-logs"
    if snapshot_dir.exists():
        snapshot_files = list(snapshot_dir.glob("snapshot-*.log"))
        print(f"\nFound {len(snapshot_files)} snapshot files in {snapshot_dir}")
        
        if snapshot_files:
            print("\nExtracting players from snapshots...")
            for snapshot_file in sorted(snapshot_files, reverse=True)[:30]:  # Process most recent 30
                players = extract_players_from_snapshot(snapshot_file)
                if players:
                    all_players.extend(players)
                    print(f"  Extracted {len(players)} players from {snapshot_file.name}")
    
    # Remove duplicates (same name and position)
    seen = set()
    unique_players = []
    for player in all_players:
        key = (player['name'].lower(), player['position'])
        if key not in seen:
            seen.add(key)
            unique_players.append(player)
    
    print(f"\nTotal unique players found: {len(unique_players)}")
    
    # Save to CSV
    output_file = Path("mlb_players.csv")
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['name', 'position'])
        writer.writeheader()
        writer.writerows(unique_players)
    
    print(f"\nSaved {len(unique_players)} players to {output_file}")
    
    # Also save as JSON for easy import
    json_file = Path("mlb_players.json")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(unique_players, f, indent=2)
    
    print(f"Also saved as JSON to {json_file}")

if __name__ == "__main__":
    main()
