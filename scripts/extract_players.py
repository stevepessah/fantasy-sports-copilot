#!/usr/bin/env python3
import re
import csv

# Read the snapshot file
with open('/Users/stevenpessah/.cursor/browser-logs/snapshot-2026-02-07T19-39-51-440Z.log', 'r') as f:
    content = f.read()

players = []
lines = content.split('\n')

# Pattern: name: [Player Name] [optional (Batter)] Player Note [TEAM] - [POSITION]
# Or: name: [Player Name] [optional note] [TEAM] - [POSITION]
pattern = r'name:\s+([A-Z][^A-Z]+(?:\s+[A-Z][^A-Z]+)*)\s*(?:\(Batter\))?\s*(?:Player Note|No new player Note|DTD)?\s*([A-Z]{2,3})\s+-\s+([A-Z][a-z0-9,]+)'

for line in lines:
    match = re.search(pattern, line)
    if match:
        player_name = match.group(1).strip()
        team = match.group(2)
        position = match.group(3)
        
        # Clean up player name
        player_name = re.sub(r'\s+\(Batter\)', '', player_name)
        player_name = player_name.strip()
        
        if player_name and team and position and len(player_name) > 2:
            players.append({'name': player_name, 'team': team, 'position': position})

# Remove duplicates based on name and team
seen = set()
unique_players = []
for p in players:
    key = (p['name'], p['team'], p['position'])
    if key not in seen:
        seen.add(key)
        unique_players.append(p)

print(f'Found {len(unique_players)} unique players')
print('\nFirst 20 players:')
for i, p in enumerate(unique_players[:20], 1):
    print(f'{i}. {p["name"]} - {p["team"]} - {p["position"]}')

# Write to CSV
csv_filename = '/Users/stevenpessah/fantasy-sports-copilot/mlb_players.csv'
with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
    fieldnames = ['Player Name', 'Team', 'Position']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    for p in unique_players:
        writer.writerow({
            'Player Name': p['name'],
            'Team': p['team'],
            'Position': p['position']
        })

print(f'\nSaved {len(unique_players)} players to {csv_filename}')
