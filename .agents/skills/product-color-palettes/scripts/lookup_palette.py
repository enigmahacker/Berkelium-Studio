#!/usr/bin/env python3
"""
Product Color Palettes Lookup Tool
Queries the 96 curated design system color palettes by keyword, category, or industry.
"""

import sys
import os
import csv
import json
import argparse

def get_csv_path():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    res_path = os.path.join(current_dir, '..', 'resources', 'palettes.csv')
    if os.path.exists(res_path):
        return res_path
    fallback = os.path.expanduser('~/.gemini/config/skills/product-color-palettes/resources/palettes.csv')
    return fallback

def load_palettes():
    csv_file = get_csv_path()
    palettes = []
    if not os.path.exists(csv_file):
        return palettes

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            palettes.append({
                "no": int(row["No"]),
                "product_type": row["Product Type"],
                "keywords": [k.strip().lower() for k in row["Keywords"].split(",")],
                "primary": row["Primary (Hex)"],
                "secondary": row["Secondary (Hex)"],
                "cta": row["CTA (Hex)"],
                "background": row["Background (Hex)"],
                "text": row["Text (Hex)"],
                "border": row["Border (Hex)"],
                "notes": row["Notes"]
            })
    return palettes

def search_palettes(query):
    query = query.strip().lower()
    palettes = load_palettes()
    results = []

    for p in palettes:
        p_name = p["product_type"].lower()
        if query in p_name or any(query in kw for kw in p["keywords"]) or query in p["notes"].lower():
            results.append(p)
    return results

def format_css_variables(p):
    return f"""/* {p['product_type']} ({p['notes']}) */
:root {{
  --color-primary: {p['primary']};
  --color-secondary: {p['secondary']};
  --color-cta: {p['cta']};
  --color-background: {p['background']};
  --color-text: {p['text']};
  --color-border: {p['border']};
}}"""

def format_tailwind_config(p):
    return f"""// {p['product_type']} Palette
colors: {{
  primary: '{p['primary']}',
  secondary: '{p['secondary']}',
  cta: '{p['cta']}',
  background: '{p['background']}',
  text: '{p['text']}',
  border: '{p['border']}',
}}"""

def main():
    parser = argparse.ArgumentParser(description="Lookup design system color palettes for any product type.")
    parser.add_argument("query", nargs="?", default="", help="Keyword, product type, or industry (e.g. 'saas', 'aerospace', 'cybersecurity')")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--css", action="store_true", help="Output CSS variables")
    parser.add_argument("--tailwind", action="store_true", help="Output Tailwind colors snippet")
    parser.add_argument("--list", action="store_true", help="List all 96 product categories")

    args = parser.parse_args()

    if args.list:
        palettes = load_palettes()
        print(f"Total categories available: {len(palettes)}\n")
        for p in palettes:
            print(f"{p['no']:2d}. {p['product_type']:<35} Primary: {p['primary']}  CTA: {p['cta']}  Bg: {p['background']}")
        return

    if not args.query:
        parser.print_help()
        sys.exit(1)

    matches = search_palettes(args.query)
    if not matches:
        print(f"No color palette found matching '{args.query}'. Run with --list to see all 96 categories.")
        sys.exit(0)

    if args.json:
        print(json.dumps(matches, indent=2))
        return

    for idx, p in enumerate(matches):
        if idx > 0:
            print("\n" + "-" * 60 + "\n")
        print(f"[{p['no']}] {p['product_type']}")
        print(f"Keywords:   {', '.join(p['keywords'])}")
        print(f"Notes:      {p['notes']}")
        print(f"Colors:")
        print(f"  • Primary:    {p['primary']}")
        print(f"  • Secondary:  {p['secondary']}")
        print(f"  • CTA:        {p['cta']}")
        print(f"  • Background: {p['background']}")
        print(f"  • Text:       {p['text']}")
        print(f"  • Border:     {p['border']}")

        if args.css:
            print("\nCSS Variables:")
            print(format_css_variables(p))
        if args.tailwind:
            print("\nTailwind Config:")
            print(format_tailwind_config(p))

if __name__ == "__main__":
    main()
