#!/bin/bash

# Fix lazy-loaded components by adding default exports

components=(
  "TerritoryExpansion"
  "BattleFormations" 
  "SpellCastingInterface"
  "TradeSystem"
  "UnitSummonInterface"
  "DiplomacyInterface"
  "Leaderboard"
  "GuildManagement"
  "WorldMap"
)

base_path="/Users/wallbomk/Documents/Projects/monarchygame/frontend/src/components"

for component in "${components[@]}"; do
  file_path="$base_path/$component.tsx"
  
  if [ -f "$file_path" ]; then
    echo "Fixing $component..."
    
    # Change export const to const
    sed -i '' "s/export const $component:/const $component:/" "$file_path"
    
    # Add default export at the end if not already present
    if ! grep -q "export default $component" "$file_path"; then
      echo "" >> "$file_path"
      echo "export default $component;" >> "$file_path"
    fi
    
    echo "Fixed $component"
  else
    echo "File not found: $file_path"
  fi
done

# Fix AchievementList in achievements subfolder
achievement_file="$base_path/achievements/AchievementList.tsx"
if [ -f "$achievement_file" ]; then
  echo "Fixing AchievementList..."
  sed -i '' "s/export const AchievementList:/const AchievementList:/" "$achievement_file"
  if ! grep -q "export default AchievementList" "$achievement_file"; then
    echo "" >> "$achievement_file"
    echo "export default AchievementList;" >> "$achievement_file"
  fi
  echo "Fixed AchievementList"
fi

# Fix BattleReports in combat subfolder  
battle_reports_file="$base_path/combat/BattleReports.tsx"
if [ -f "$battle_reports_file" ]; then
  echo "Fixing BattleReports..."
  sed -i '' "s/export const BattleReports:/const BattleReports:/" "$battle_reports_file"
  if ! grep -q "export default BattleReports" "$battle_reports_file"; then
    echo "" >> "$battle_reports_file"
    echo "export default BattleReports;" >> "$battle_reports_file"
  fi
  echo "Fixed BattleReports"
fi

echo "All components fixed!"
