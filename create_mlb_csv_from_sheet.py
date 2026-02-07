#!/usr/bin/env python3
"""
Create mlb_players.csv from Google Sheets data structure.
Uses the data format visible in the web search results.
"""

import csv

# Based on the web search results provided, here's the data structure:
# The Google Sheet has columns: Team | Player Name | Position | Pos Abbreviation
# We need to convert to: name, position (using Pos Abbreviation)

# Since the full data isn't available in the search results, 
# let's create a script that can process the exported CSV
# The user should export the Google Sheet as CSV first

def process_google_sheet_csv(input_csv, output_csv):
    """Process Google Sheet CSV and convert to mlb_players.csv format."""
    players = []
    
    try:
        with open(input_csv, 'r', encoding='utf-8') as f:
            # Try to detect delimiter
            sample = f.read(1024)
            f.seek(0)
            delimiter = ',' if sample.count(',') > sample.count('\t') else '\t'
            
            reader = csv.reader(f)
            header = next(reader)  # Skip header
            
            # Find column indices
            team_idx = None
            name_idx = None
            pos_idx = None
            pos_abbrev_idx = None
            
            for i, col in enumerate(header):
                col_lower = col.lower()
                if 'team' in col_lower:
                    team_idx = i
                elif 'player' in col_lower and 'name' in col_lower:
                    name_idx = i
                elif 'position' in col_lower and 'abbreviation' not in col_lower:
                    pos_idx = i
                elif 'abbreviation' in col_lower or 'pos abbrev' in col_lower:
                    pos_abbrev_idx = i
            
            # Default to first 4 columns if not found
            if name_idx is None:
                name_idx = 1
            if pos_abbrev_idx is None:
                pos_abbrev_idx = 3
            
            for row in reader:
                if len(row) > max(name_idx or 0, pos_abbrev_idx or 0):
                    player_name = row[name_idx].strip() if name_idx < len(row) else ""
                    position = row[pos_abbrev_idx].strip() if pos_abbrev_idx < len(row) else ""
                    
                    # Fallback to Position column if Pos Abbreviation is empty
                    if not position and pos_idx is not None and pos_idx < len(row):
                        pos_full = row[pos_idx].strip()
                        # Convert full position names to abbreviations
                        position = convert_position_to_abbrev(pos_full)
                    
                    if player_name and position:
                        players.append({
                            'name': player_name,
                            'position': position
                        })
    
    except FileNotFoundError:
        print(f"Error: {input_csv} not found.")
        print("\nTo use this script:")
        print("1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1hYr8z6ymm8Or0Nrh3aEj20DuMSpQoukUjvmEw8eHJgM/edit")
        print("2. Go to File > Download > Comma-separated values (.csv)")
        print("3. Save it as 'google_sheet_export.csv' in this directory")
        print("4. Run this script again")
        return []
    except Exception as e:
        print(f"Error processing {input_csv}: {e}")
        import traceback
        traceback.print_exc()
        return []
    
    # Remove duplicates
    seen = set()
    unique_players = []
    for player in players:
        key = (player['name'].lower(), player['position'])
        if key not in seen:
            seen.add(key)
            unique_players.append(player)
    
    # Write output
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['name', 'position'])
        writer.writeheader()
        writer.writerows(unique_players)
    
    print(f"✓ Converted {len(unique_players)} unique players to {output_csv}")
    return unique_players

def convert_position_to_abbrev(position):
    """Convert full position name to abbreviation."""
    position_lower = position.lower()
    mapping = {
        'pitcher': 'P',
        'catcher': 'C',
        'first base': '1B',
        'second base': '2B',
        'third base': '3B',
        'shortstop': 'SS',
        'left field': 'LF',
        'center field': 'CF',
        'right field': 'RF',
        'outfielder': 'OF',
        'designated hitter': 'DH',
    }
    for full, abbrev in mapping.items():
        if full in position_lower:
            return abbrev
    return position  # Return as-is if no match

if __name__ == "__main__":
    import sys
    
    input_file = "google_sheet_export.csv"
    output_file = "mlb_players.csv"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    players = process_google_sheet_csv(input_file, output_file)
