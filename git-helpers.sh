#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display a header
show_header() {
  echo -e "${BLUE}======================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}======================================${NC}"
}

# Function to display status with color
show_status() {
  echo -e "${YELLOW}$1${NC}"
}

# Function to handle errors
handle_error() {
  echo -e "${RED}Error: $1${NC}"
  exit 1
}

# Function to handle success
handle_success() {
  echo -e "${GREEN}$1${NC}"
}

# Check if git is installed
if ! command -v git &> /dev/null; then
  handle_error "git is not installed or not in PATH"
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  handle_error "Not in a git repository"
fi

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED HEAD")

# Menu function
show_menu() {
  show_header "Git Helper Commands"
  echo "Current branch: ${YELLOW}$CURRENT_BRANCH${NC}"
  echo
  echo "1. Status Check        - Show status and changes"
  echo "2. Sync with Remote    - Make local match remote exactly"
  echo "3. Quick Commit & Push - Commit all changes and push"
  echo "4. Branch Management   - List and switch branches"
  echo "5. View Recent Commits - Show recent commit history"
  echo "6. Discard All Changes - Reset to last commit (CAREFUL!)"
  echo "7. Pull Latest Changes - Get latest changes from remote"
  echo "8. Show Differences    - Show all pending changes"
  echo "q. Quit"
  echo
  read -p "Enter your choice: " choice
  
  case $choice in
    1) status_check ;;
    2) sync_with_remote ;;
    3) quick_commit_push ;;
    4) branch_management ;;
    5) view_recent_commits ;;
    6) discard_all_changes ;;
    7) pull_latest ;;
    8) show_differences ;;
    q|Q) exit 0 ;;
    *) echo "Invalid choice. Please try again."; show_menu ;;
  esac
}

# 1. Status Check
status_check() {
  show_header "Git Status Check"
  
  show_status "Checking current branch status..."
  git status
  
  echo
  show_status "Checking for stashed changes..."
  git stash list
  
  echo
  show_status "Checking differences with remote..."
  LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "No commits yet")
  REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "No remote branch")
  
  if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    handle_success "Local and remote are in sync! (commit: ${LOCAL_COMMIT:0:8})"
  else
    echo -e "${YELLOW}Local and remote are different.${NC}"
    echo -e "Local commit:  ${YELLOW}${LOCAL_COMMIT:0:8}${NC}"
    echo -e "Remote commit: ${YELLOW}${REMOTE_COMMIT:0:8}${NC}"
    
    # Show ahead/behind status
    AHEAD_BEHIND=$(git rev-list --count --left-right origin/$CURRENT_BRANCH...HEAD 2>/dev/null || echo "0 0")
    BEHIND=$(echo $AHEAD_BEHIND | awk '{print $1}')
    AHEAD=$(echo $AHEAD_BEHIND | awk '{print $2}')
    
    if [ "$BEHIND" -gt 0 ]; then
      echo -e "${YELLOW}Your branch is behind the remote by $BEHIND commit(s)${NC}"
    fi
    
    if [ "$AHEAD" -gt 0 ]; then
      echo -e "${YELLOW}Your branch is ahead of the remote by $AHEAD commit(s)${NC}"
    fi
  fi
  
  echo
  read -p "Press Enter to continue..."
  show_menu
}

# 2. Sync with Remote
sync_with_remote() {
  show_header "Sync Local with Remote"
  
  show_status "Fetching latest changes from remote..."
  git fetch origin || handle_error "Failed to fetch from remote"
  
  # Check if there are uncommitted changes
  if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Uncommitted changes detected.${NC}"
    read -p "Do you want to stash these changes before syncing? (y/n): " stash_changes
    
    if [[ $stash_changes == "y" || $stash_changes == "Y" ]]; then
      echo -e "${YELLOW}Stashing changes...${NC}"
      git stash save "Auto-stashed before git sync $(date)" || handle_error "Failed to stash changes"
      handle_success "Changes stashed successfully."
    else
      echo -e "${RED}Warning: Uncommitted changes will be lost when resetting to remote.${NC}"
      read -p "Continue anyway? (y/n): " continue_anyway
      
      if [[ $continue_anyway != "y" && $continue_anyway != "Y" ]]; then
        echo -e "${YELLOW}Operation cancelled.${NC}"
        read -p "Press Enter to continue..."
        show_menu
        return
      fi
    fi
  fi
  
  # Reset to match remote
  echo -e "${YELLOW}Resetting local branch to match remote...${NC}"
  git reset --hard origin/$CURRENT_BRANCH || handle_error "Failed to reset local branch"
  
  handle_success "Successfully reset local branch to match remote!"
  
  read -p "Press Enter to continue..."
  show_menu
}

# 3. Quick Commit & Push
quick_commit_push() {
  show_header "Quick Commit & Push"
  
  # Check if there are changes to commit
  if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}No changes to commit.${NC}"
    read -p "Press Enter to continue..."
    show_menu
    return
  fi
  
  # Show what's going to be committed
  show_status "Changes to be committed:"
  git status --short
  
  # Get commit message
  echo
  read -p "Enter commit message: " commit_message
  
  if [ -z "$commit_message" ]; then
    commit_message="Quick commit on $(date)"
  fi
  
  # Commit changes
  show_status "Committing changes..."
  git add . || handle_error "Failed to add files"
  git commit -m "$commit_message" || handle_error "Failed to commit changes"
  
  # Push to remote
  show_status "Pushing to remote..."
  git push origin $CURRENT_BRANCH || handle_error "Failed to push to remote"
  
  handle_success "Changes committed and pushed successfully!"
  
  read -p "Press Enter to continue..."
  show_menu
}

# 4. Branch Management
branch_management() {
  show_header "Branch Management"
  
  show_status "Local branches (* indicates current branch):"
  git branch
  
  echo
  show_status "Remote branches:"
  git branch -r
  
  echo
  read -p "Do you want to switch to another branch? (y/n): " switch_branch
  
  if [[ $switch_branch == "y" || $switch_branch == "Y" ]]; then
    read -p "Enter branch name: " branch_name
    
    # Check if branch exists
    if ! git show-ref --verify --quiet refs/heads/$branch_name; then
      # Branch doesn't exist locally, check if it exists on remote
      if git show-ref --verify --quiet refs/remotes/origin/$branch_name; then
        echo -e "${YELLOW}Branch exists on remote but not locally. Creating tracking branch...${NC}"
        git checkout -b $branch_name origin/$branch_name || handle_error "Failed to checkout branch"
      else
        echo -e "${YELLOW}Branch doesn't exist. Do you want to create it? (y/n): ${NC}"
        read create_branch
        
        if [[ $create_branch == "y" || $create_branch == "Y" ]]; then
          git checkout -b $branch_name || handle_error "Failed to create branch"
        else
          echo -e "${YELLOW}Operation cancelled.${NC}"
        fi
      fi
    else
      # Branch exists locally
      git checkout $branch_name || handle_error "Failed to checkout branch"
    fi
    
    handle_success "Switched to branch: $branch_name"
  fi
  
  read -p "Press Enter to continue..."
  show_menu
}

# 5. View Recent Commits
view_recent_commits() {
  show_header "Recent Commit History"
  
  # Get number of commits to show
  read -p "How many recent commits do you want to see? (default: 10) " num_commits
  
  if [ -z "$num_commits" ]; then
    num_commits=10
  fi
  
  show_status "Showing last $num_commits commits:"
  git log --pretty=format:"%C(yellow)%h%Creset %C(green)%ad%Creset | %s %C(red)[%an]%Creset" --date=short -n $num_commits
  
  echo
  read -p "Press Enter to continue..."
  show_menu
}

# 6. Discard All Changes
discard_all_changes() {
  show_header "Discard All Changes"
  
  if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}No changes to discard.${NC}"
    read -p "Press Enter to continue..."
    show_menu
    return
  fi
  
  show_status "The following changes will be discarded:"
  git status --short
  
  echo
  echo -e "${RED}WARNING: This will permanently discard all changes above!${NC}"
  read -p "Are you SURE you want to continue? (type 'yes' to confirm): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Operation cancelled.${NC}"
    read -p "Press Enter to continue..."
    show_menu
    return
  fi
  
  # Discard changes
  git reset --hard HEAD || handle_error "Failed to discard changes"
  
  # Also remove untracked files
  read -p "Do you also want to remove untracked files? (y/n): " remove_untracked
  
  if [[ $remove_untracked == "y" || $remove_untracked == "Y" ]]; then
    git clean -fd || handle_error "Failed to remove untracked files"
    handle_success "All changes discarded and untracked files removed!"
  else
    handle_success "All changes discarded!"
  fi
  
  read -p "Press Enter to continue..."
  show_menu
}

# 7. Pull Latest Changes
pull_latest() {
  show_header "Pull Latest Changes"
  
  # Check for uncommitted changes
  if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}You have uncommitted changes. Pulling might cause conflicts.${NC}"
    read -p "Do you want to stash these changes before pulling? (y/n): " stash_changes
    
    if [[ $stash_changes == "y" || $stash_changes == "Y" ]]; then
      echo -e "${YELLOW}Stashing changes...${NC}"
      git stash save "Auto-stashed before pull $(date)" || handle_error "Failed to stash changes"
      handle_success "Changes stashed successfully."
    fi
  fi
  
  # Pull changes
  show_status "Pulling latest changes from remote..."
  git pull origin $CURRENT_BRANCH || handle_error "Failed to pull from remote"
  
  handle_success "Successfully pulled latest changes!"
  
  # Pop stash if we stashed changes
  if [[ $stash_changes == "y" || $stash_changes == "Y" ]]; then
    echo -e "${YELLOW}Reapplying stashed changes...${NC}"
    git stash pop || handle_error "Failed to pop stashed changes. You might need to resolve conflicts manually."
  fi
  
  read -p "Press Enter to continue..."
  show_menu
}

# 8. Show Differences
show_differences() {
  show_header "Show Differences"
  
  if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}No changes to show.${NC}"
    read -p "Press Enter to continue..."
    show_menu
    return
  fi
  
  show_status "Showing differences:"
  git diff --color | less -R
  
  read -p "Press Enter to continue..."
  show_menu
}

# Start the menu
show_menu 