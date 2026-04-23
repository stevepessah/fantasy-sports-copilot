#!/usr/bin/env python3
"""
Script to convert Google Sheets data to mlb_players.csv format.
Since direct export requires authentication, this script will help
process the data structure from the web search results.
"""

import csv
import re

# Based on the web search results, the Google Sheet has:
# Column A: Team
# Column B: Player Name  
# Column C: Position
# Column D: Pos Abbreviation

# The original mlb_players.csv format is:
# name,position

# We'll create a new CSV with the same format but using data from the Google Sheet
# Since we can't directly export, we'll need to manually extract or use the provided data

def create_csv_from_web_data():
    """
    Create CSV from the data visible in web search results.
    This is a template - you may need to add more data manually.
    """
    # Sample data from web search results (incomplete - need full dataset)
    players = []
    
    # This is just a template - the actual data needs to be extracted
    # from the Google Sheet or provided manually
    
    print("To complete this conversion:")
    print("1. Export the Google Sheet as CSV manually (File > Download > CSV)")
    print("2. Save it as 'google_sheet_export.csv' in this directory")
    print("3. Run this script again to convert it")
    print("\nOR")
    print("1. Copy all data from the Google Sheet")
    print("2. Paste it into a new file 'google_sheet_export.csv'")
    print("3. Run this script to convert it")
    
    return players

def convert_google_sheet_csv(input_file, output_file):
    """
    Convert Google Sheet CSV format to mlb_players.csv format.
    
    Google Sheet format: Team, Player Name, Position, Pos Abbreviation
    Output format: name, position
    """
    players = []
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Handle different possible column names
                player_name = row.get('Player Name') or row.get('player_name') or row.get('Player') or row.get('Name')
                position = row.get('Pos Abbreviation') or row.get('pos_abbreviation') or row.get('Position') or row.get('position')
                
                if player_name and position:
                    players.append({
                        'name': player_name.strip(),
                        'position': position.strip()
                    })
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        print("Please export the Google Sheet as CSV and save it as 'google_sheet_export.csv'")
        return []
    except Exception as e:
        print(f"Error reading {input_file}: {e}")
        return []
    
    # Remove duplicates
    seen = set()
    unique_players = []
    for player in players:
        key = (player['name'].lower(), player['position'])
        if key not in seen:
            seen.add(key)
            unique_players.append(player)
    
    # Write to output file
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['name', 'position'])
        writer.writeheader()
        writer.writerows(unique_players)
    
    print(f"Converted {len(unique_players)} unique players to {output_file}")
    return unique_players

if __name__ == "__main__":
    import sys
    
    # Try to convert if file exists
    input_file = "google_sheet_export.csv"
    output_file = "mlb_players.csv"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    players = convert_google_sheet_csv(input_file, output_file)
    
    if not players:
        create_csv_from_web_data()
