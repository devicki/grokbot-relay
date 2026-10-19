# shellcheck shell=bash
# shellcheck disable=SC2034  # menu registries are read via nameref in ui_loop
# grokbot-relay TUI. Sourced by bin/grokbot-relay; uses its cmd_* functions.
# Backend: whiptail > dialog > plain bash prompts.

UI=plain
if command -v whiptail >/dev/null 2>&1; then UI=whiptail
elif command -v dialog >/dev/null 2>&1; then UI=dialog; fi
UI_TITLE="grokbot-relay"
UI_H=20; UI_W=74

# ---------------------------------------------------------------- primitives
ui_danger() { # text -> 0 only if the user types YES
  case "$UI" in
    plain) local a; printf '\n!!! DANGER !!!\n%b\nType YES to continue: ' "$1"; read -r a </dev/tty; [[ "$a" == YES ]] ;;
    *) local a
       a="$(NEWT_COLORS='root=,red window=,red border=white,red textbox=white,red button=black,white' DIALOGRC='' \
         "$UI" --title "DANGER: $UI_TITLE" --inputbox "$1\n\nType YES to continue:" "$UI_H" "$UI_W" "" 3>&1 1>&2 2>&3)" || return 1
       [[ "$a" == YES ]] ;;
  esac
}

ui_msg() { # text
  case "$UI" in
    plain) printf '\n%b\n\n' "$1"; read -r -p "[Enter] " _ </dev/tty ;;
    *) "$UI" --title "$UI_TITLE" --msgbox "$1" "$UI_H" "$UI_W" ;;
  esac
}

ui_yesno() { # text -> 0 yes / 1 no
  case "$UI" in
    plain) local a; printf '%b [y/N] ' "$1"; read -r a </dev/tty; [[ "$a" =~ ^[Yy] ]] ;;
    *) "$UI" --title "$UI_TITLE" --yesno "$1" "$UI_H" "$UI_W" ;;
  esac
}

ui_input() { # text default -> stdout value; status 1 on cancel
  case "$UI" in
    plain) local a; read -r -p "$1 [$2]: " a </dev/tty || return 1; echo "${a:-$2}" ;;
    *) "$UI" --title "$UI_TITLE" --inputbox "$1" 10 "$UI_W" "$2" 3>&1 1>&2 2>&3 ;;
  esac
}

ui_menu() { # text, then "tag|label" items -> stdout tag; status 1 on cancel/back
  local text="$1"; shift
  local -a args=() tags=()
  local it
  for it in "$@"; do args+=("${it%%|*}" "${it#*|}"); tags+=("${it%%|*}"); done
  case "$UI" in
    plain)
      printf '\n== %s ==\n%b\n' "$UI_TITLE" "$text" >&2
      local i=1
      for it in "$@"; do printf '  %2d) %s\n' "$i" "${it#*|}" >&2; i=$((i+1)); done
      printf '   0) Back / quit\n' >&2
      local n; read -r -p "> " n </dev/tty || return 1
      [[ "$n" =~ ^[0-9]+$ ]] && (( n >= 1 && n <= ${#tags[@]} )) || return 1
      echo "${tags[$((n-1))]}" ;;
    *) "$UI" --title "$UI_TITLE" --menu "$text" "$UI_H" "$UI_W" 12 "${args[@]}" 3>&1 1>&2 2>&3 ;;
  esac
}

# Run a non-interactive command, capture output, show it in a box.
ui_run() { # title, command...
  local title="$1"; shift
  local out rc=0
  out="$( ( "$@" ) 2>&1 )" || rc=$?
  [[ -n "$out" ]] || out="(no output)"
  (( rc == 0 )) || out="$out"$'\n\n'"[exit $rc]"
  case "$UI" in
    plain) printf '\n--- %s ---\n%s\n' "$title" "$out"; read -r -p "[Enter] " _ </dev/tty ;;
    *) "$UI" --title "$UI_TITLE: $title" --scrolltext --msgbox "$out" "$UI_H" "$UI_W" 2>/dev/null \
         || "$UI" --title "$UI_TITLE: $title" --msgbox "$out" "$UI_H" "$UI_W" ;;
  esac
  return "$rc"
}

# Run an interactive command on the plain terminal (login, logs -f, editor).
ui_shell() { # title, command...
  local title="$1"; shift
  clear 2>/dev/null || true
  echo "== $title =="
  local rc=0; ( "$@" ) || rc=$?
  echo; read -r -p "[exit $rc] Press Enter to return to the menu " _ </dev/tty
  return "$rc"
}

ui_root_or_msg() {
  [[ $EUID -eq 0 ]] && return 0
  ui_msg "This needs root. Quit and run: sudo grokbot-relay"
  return 1
}

# ---------------------------------------------------------------- menu loop
# Registry entries: "id|label|function". Add a feature = add one line.
ui_loop() { # text, array-name
  local text="$1"; local -n reg="$2"
  local -a items=(); local e
  for e in "${reg[@]}"; do IFS='|' read -r id label _ <<<"$e"; items+=("$id|$label"); done
  while true; do
    local pick; pick="$(ui_menu "$text" "${items[@]}")" || return 0
    for e in "${reg[@]}"; do
      IFS='|' read -r id _ fn <<<"$e"
      if [[ "$id" == "$pick" ]]; then
        [[ "$fn" == back ]] && return 0
        "$fn" || true
      fi
    done
  done
}

# ---------------------------------------------------------------- actions
t_status()   { ui_run "status" cmd_status; }
t_start()    { ui_root_or_msg && ui_run "start" cmd_svc start; }
t_stop()     { ui_root_or_msg && ui_run "stop" cmd_svc stop; }
t_restart()  { ui_root_or_msg && ui_run "restart" cmd_svc restart; }
t_logs()     { ui_run "logs (last 100)" cmd_logs; }
t_logs_f()   { ui_shell "logs -f (Ctrl+C to stop)" cmd_logs -f; }
t_login()    { ui_root_or_msg || return 1
  ui_msg "Cursor sign-in as the grokbot user.\n\nA sign-in link will be printed. Open it in any browser (another computer is fine), finish signing in, and the command returns."
  ui_shell "bdk login" cmd_login; }
t_update()   { ui_root_or_msg && ui_yesno "Pull the source clone, recopy, npm ci and restart?\nenv and agents.json are kept." && ui_run "update" cmd_update; }
t_bdk_check(){ ui_run "bdk-check" cmd_bdk_check; }
t_bdk_up()   { ui_root_or_msg && ui_yesno "Upgrade @cursor/bdk to the latest version?\nIt is validated first; on failure it rolls back." && ui_run "bdk-upgrade" cmd_bdk_upgrade; }
t_doctor()   { ui_run "doctor" cmd_doctor; }
t_connect()  { ui_msg "Regular users connect Claude Code like this:\n\n  1) Admin: sudo usermod -aG grokbot <user>\n  2) User logs out and back in\n  3) User runs: grokbot-relay connect-claude\n  4) claude plugin marketplace add devicki/dev-toolkit\n     claude plugin install grokbot-relay@dev-toolkit\n\nThe token is read from /etc/grokbot-relay/env at each start; it is not stored in Claude Code's config."; }
t_uninstall() {
  ui_root_or_msg || return 1
  local mode
  mode="$(ui_menu "Uninstall grokbot-relay. The source clone is never touched." \
    "ask|Remove service and app; ask about config, login, user" \
    "keep|Remove service and app; keep config (token, agents.json)" \
    "purge|Remove EVERYTHING (config, Cursor login, grokbot user)")" || return 0
  ui_danger "This stops the relay and removes $UNIT, $APP_DIR and /usr/local/bin/grokbot-relay.\nMode: $mode" || { ui_msg "Cancelled."; return 0; }
  case "$mode" in
    ask)   ui_shell "uninstall" cmd_uninstall -y ;;
    keep)  ui_shell "uninstall" cmd_uninstall -y --keep-config ;;
    purge) ui_shell "uninstall" cmd_uninstall -y --purge ;;
  esac
  clear 2>/dev/null || true
  echo "grokbot-relay was uninstalled. Exiting the menu."
  exit 0
}
t_about()    { ui_msg "grokbot-relay $(read_version "$(script_root)")\n@cursor/bdk $(installed_bdk)\n\nhttps://github.com/devicki/grokbot-relay\nCLI help: grokbot-relay help"; }

t_agents_list() { ui_run "agents" cmd_agents list; }
t_agents_add() {
  ui_root_or_msg || return 1
  local n; n="$(ui_input "Bot name, exactly as shown in the Grok Bot app:" "")" || return 0
  [[ -n "$n" ]] || return 0
  ui_run "agents add" cmd_agents add "$n"
}
t_agents_remove() {
  ui_root_or_msg || return 1
  local -a items=(); local n
  while IFS= read -r n; do [[ -n "$n" && "$n" != "("* ]] && items+=("$n|$n"); done < <(agents_js list 2>/dev/null)
  (( ${#items[@]} )) || { ui_msg "No agents listed."; return 0; }
  n="$(ui_menu "Remove which bot? (the last one cannot be removed)" "${items[@]}")" || return 0
  ui_run "agents remove" cmd_agents remove "$n"
}
t_agents_edit() { ui_root_or_msg && ui_shell "agents edit" cmd_agents edit; }

AGENTS_MENU=(
  "list|List allowed bots|t_agents_list"
  "add|Add a bot|t_agents_add"
  "remove|Remove a bot|t_agents_remove"
  "edit|Edit agents.json in \$EDITOR|t_agents_edit"
  "back|Back|back"
)
t_agents() { ui_loop "Bot allowlist ($AGENTS_FILE)" AGENTS_MENU; }

SERVICE_MENU=(
  "start|Start|t_start"
  "stop|Stop|t_stop"
  "restart|Restart|t_restart"
  "logs|Recent logs|t_logs"
  "follow|Follow logs (-f)|t_logs_f"
  "back|Back|back"
)
t_service() { ui_loop "Service control" SERVICE_MENU; }

BDK_MENU=(
  "check|Check for a newer @cursor/bdk|t_bdk_check"
  "upgrade|Upgrade @cursor/bdk (validate, rollback on failure)|t_bdk_up"
  "back|Back|back"
)
t_bdk() { ui_loop "Cursor BDK" BDK_MENU; }

MAIN_MENU=(
  "status|Status|t_status"
  "service|Start / stop / restart / logs|t_service"
  "agents|Bots (allowlist)|t_agents"
  "login|Cursor login|t_login"
  "doctor|Doctor (health check)|t_doctor"
  "update|Update grokbot-relay|t_update"
  "bdk|Cursor BDK check / upgrade|t_bdk"
  "wizard|Run setup wizard again|tui_wizard"
  "connect|Connect Claude Code (info)|t_connect"
  "about|About / version|t_about"
  "uninstall|Uninstall (danger)|t_uninstall"
  "quit|Quit|back"
)

# ---------------------------------------------------------------- wizard
w_welcome() {
  ui_yesno "Welcome to grokbot-relay $(read_version "$(script_root)").\n\nThis wizard will:\n  - check Node.js\n  - install the service (user, /opt app, env, systemd)\n  - set your bot names\n  - sign in to Cursor\n  - start the relay and run checks\n  - let regular users connect\n\nContinue?"
}
w_node() {
  local out; if out="$( (check_node) 2>&1 )"; then ui_msg "Node.js $(node -v): OK"; else ui_msg "$out\n\nInstall Node.js 22+ and run the wizard again."; return 1; fi
}
w_install() {
  local port=3000 cur
  if [[ -r "$ENV_FILE" ]]; then cur="$(env_value GROKBOT_RELAY_PORT)"; port="${cur:-3000}"; fi
  if [[ -f "$ENV_FILE" ]]; then
    ui_msg "Existing config found (port $port). It will be kept."
  else
    port="$(ui_input "Port for the relay (listens on 127.0.0.1 only):" "$port")" || return 1
    [[ "$port" =~ ^[0-9]+$ ]] || { ui_msg "Invalid port."; return 1; }
  fi
  ui_run "install" cmd_install --port "$port"
}
w_agents() {
  while true; do
    local list; list="$(agents_js list 2>/dev/null || true)"
    local pick
    pick="$(ui_menu "Allowed bots now:\n$list\n\nAdd your bots exactly as named in the Grok Bot app, then remove the example 'Research Bot'. The list can never be empty." \
      "add|Add a bot" "remove|Remove a bot" "done|Done")" || pick="done"
    case "$pick" in
      add) t_agents_add || true ;;
      remove) t_agents_remove || true ;;
      done)
        if grep -qx "Research Bot" <<<"$list" && ! ui_yesno "The example 'Research Bot' is still listed. Continue anyway?"; then continue; fi
        return 0 ;;
    esac
  done
}
w_login()  { ui_yesno "Sign in to Cursor now? (needed before the relay can reach your bots)" && t_login; return 0; }
w_start()  { ui_yesno "Start the relay now?" && ui_run "start" cmd_svc start; return 0; }
w_doctor() { ui_run "doctor" cmd_doctor; return 0; }
w_users() {
  while ui_yesno "Add a regular user to the grokbot group (so they can connect Claude Code)?"; do
    local u; u="$(ui_input "Username:" "")" || break
    [[ -n "$u" ]] || break
    if id "$u" >/dev/null 2>&1; then ui_run "usermod" usermod -aG "$SVC_USER" "$u"; else ui_msg "No such user: $u"; fi
  done
  t_connect
}

# Wizard steps: "id|label|function". Add a step = add one line.
WIZARD_STEPS=(
  "welcome|Welcome|w_welcome"
  "node|Node.js check|w_node"
  "install|Install service|w_install"
  "agents|Bot names|w_agents"
  "login|Cursor login|w_login"
  "start|Start|w_start"
  "doctor|Doctor|w_doctor"
  "users|Group users|w_users"
)

tui_wizard() {
  ui_root_or_msg || return 1
  local e id label fn
  for e in "${WIZARD_STEPS[@]}"; do
    IFS='|' read -r id label fn <<<"$e"
    UI_TITLE="grokbot-relay setup: $label"
    if ! "$fn"; then UI_TITLE="grokbot-relay"; ui_msg "Setup stopped at: $label.\nRun it again any time: sudo grokbot-relay install --tui"; return 1; fi
  done
  UI_TITLE="grokbot-relay"
  ui_msg "Setup finished. Open the menu any time with: sudo grokbot-relay"
}

tui_main() {
  [[ -t 0 && -t 1 ]] || die "The TUI needs a terminal. See: grokbot-relay help"
  if [[ ! -d "$RELAY_DIR/node_modules" ]] && [[ $EUID -eq 0 ]]; then
    ui_yesno "grokbot-relay is not installed yet. Run the setup wizard?" && tui_wizard
  fi
  ui_loop "grokbot-relay $(read_version "$(script_root)") — choose an action" MAIN_MENU
  clear 2>/dev/null || true
}
