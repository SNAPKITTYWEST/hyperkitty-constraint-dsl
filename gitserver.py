import os
import sys
import json
import time
import threading
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, render_template_string, send_file, abort
from dulwich.repo import Repo
from dulwich.web import HTTPGitApplication, make_wsgi_chain
from dulwich.objects import Blob, Tree, Commit
from dulwich.index import build_index_from_tree
from dulwich.diff_tree import tree_changes
from dulwich.pack import write_pack_objects
from dulwich.protocol import ZERO_SHA
import requests

REPOS_DIR = Path("./repos")
REPOS_DIR.mkdir(exist_ok=True)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "qwen/qwen-2.5-coder-32b-instruct"

app = Flask(__name__)

git_app = HTTPGitApplication(REPOS_DIR, export_all=True)
git_wsgi = make_wsgi_chain(git_app)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Git Server</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
        h1 { color: #4ec9b0; }
        h2 { color: #dcdcaa; border-bottom: 1px solid #333; padding-bottom: 5px; }
        .repo-list { list-style: none; padding: 0; }
        .repo-item { padding: 10px; margin: 5px 0; background: #252526; border-radius: 4px; }
        .repo-item a { color: #9cdcfe; text-decoration: none; font-size: 1.1em; }
        .repo-item a:hover { color: #4ec9b0; }
        .file-tree { margin-left: 20px; }
        .file-item { padding: 2px 0; }
        .file-item a { color: #ce9178; }
        .dir-item a { color: #dcdcaa; }
        .commit-list { list-style: none; padding: 0; }
        .commit-item { padding: 10px; margin: 5px 0; background: #252526; border-radius: 4px; }
        .commit-hash { color: #b5cea8; font-size: 0.9em; }
        .commit-msg { color: #d4d4d4; margin: 5px 0; }
        .commit-meta { color: #6a9955; font-size: 0.85em; }
        .content { background: #1e1e1e; border: 1px solid #333; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .btn { background: #0e639c; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #1177bb; }
        .btn-danger { background: #a1260d; }
        .btn-danger:hover { background: #cc3300; }
        input[type=text] { background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; padding: 8px; border-radius: 3px; width: 300px; }
        form { display: inline; }
        .breadcrumb { margin-bottom: 15px; }
        .breadcrumb a { color: #9cdcfe; text-decoration: none; }
        .breadcrumb a:hover { text-decoration: underline; }
        .breadcrumb span { color: #888; margin: 0 5px; }
        pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        .diff { background: #1e1e1e; }
        .diff-add { color: #b5cea8; }
        .diff-del { color: #f44747; }
        .diff-hdr { color: #dcdcaa; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #333; }
        th { color: #dcdcaa; }
    </style>
</head>
<body>
    <h1>🗂 Git Server</h1>
    
    {% if repo_name %}
    <div class="breadcrumb">
        <a href="/">Repos</a>
        {% for part in breadcrumb %}
        <span>/</span>
        {% if part.url %}<a href="{{ part.url }}">{{ part.name }}</a>{% else %}<span>{{ part.name }}</span>{% endif %}
        {% endfor %}
    </div>
    <h2>{{ repo_name }}</h2>
    
    {% if view == 'tree' %}
    <div class="file-tree">
        {% for item in tree_items %}
        <div class="file-item">
            {% if item.type == 'tree' %}
            <span class="dir-item">📁 <a href="{{ item.url }}">{{ item.name }}</a></span>
            {% else %}
            <span class="file-item">📄 <a href="{{ item.url }}">{{ item.name }}</a></span>
            {% endif %}
        </div>
        {% endfor %}
    </div>
    
    {% elif view == 'blob' %}
    <h3>{{ blob_path }}</h3>
    <div class="content"><pre>{{ blob_content }}</pre></div>
    
    {% elif view == 'log' %}
    <ul class="commit-list">
        {% for commit in commits %}
        <li class="commit-item">
            <div class="commit-hash">{{ commit.short_id }}</div>
            <div class="commit-msg">{{ commit.message }}</div>
            <div class="commit-meta">{{ commit.author }} • {{ commit.date }}</div>
        </li>
        {% endfor %}
    </ul>
    
    {% elif view == 'commit' %}
    <div class="commit-item">
        <div class="commit-hash">{{ commit.id }}</div>
        <div class="commit-msg">{{ commit.message }}</div>
        <div class="commit-meta">{{ commit.author }} • {{ commit.date }}</div>
    </div>
    <h3>Changes</h3>
    <div class="content"><pre>{{ commit_diff }}</pre></div>
    {% endif %}
    
    {% else %}
    <form method="post" action="/api/repos" style="margin-bottom: 20px;">
        <input type="text" name="name" placeholder="Repository name" required>
        <button type="submit" class="btn">Create Repository</button>
    </form>
    <ul class="repo-list">
        {% for repo in repos %}
        <li class="repo-item">
            <a href="/{{ repo }}">{{ repo }}</a>
            <form method="post" action="/api/repos/{{ repo }}/delete" style="display:inline;">
                <button type="submit" class="btn btn-danger" onclick="return confirm('Delete {{ repo }}?')">Delete</button>
            </form>
        </li>
        {% endfor %}
    </ul>
    {% endif %}
</body>
</html>
"""

def get_repo_path(name):
    return REPOS_DIR / f"{name}.git"

def list_repos():
    repos = []
    for path in REPOS_DIR.iterdir():
        if path.is_dir() and path.name.endswith(".git"):
            repos.append(path.name[:-4])
    return sorted(repos)

def open_repo(name):
    path = get_repo_path(name)
    if not path.exists():
        return None
    return Repo(str(path))

def get_tree(repo, tree_id, path=""):
    tree = repo[tree_id]
    items = []
    for entry in tree.items():
        obj = repo[entry.sha]
        item_path = f"{path}/{entry.path.decode()}" if path else entry.path.decode()
        if isinstance(obj, Tree):
            items.append({
                "name": entry.path.decode(),
                "type": "tree",
                "url": f"/{repo.path.name[:-4]}/tree/{entry.sha.decode()}/{item_path.lstrip('/')}"
            })
        elif isinstance(obj, Blob):
            items.append({
                "name": entry.path.decode(),
                "type": "blob",
                "url": f"/{repo.path.name[:-4]}/blob/{entry.sha.decode()}/{item_path.lstrip('/')}"
            })
    items.sort(key=lambda x: (x["type"] != "tree", x["name"].lower()))
    return items

def get_blob_content(repo, blob_id):
    blob = repo[blob_id]
    try:
        return blob.data.decode("utf-8")
    except UnicodeDecodeError:
        return "<binary data>"

def get_commits(repo, limit=50):
    commits = []
    walker = repo.get_walker()
    for entry in walker:
        if len(commits) >= limit:
            break
        commit = entry.commit
        commits.append({
            "id": commit.id.decode(),
            "short_id": commit.id.decode()[:8],
            "message": commit.message.decode().strip(),
            "author": commit.author.decode(),
            "date": datetime.fromtimestamp(commit.commit_time).strftime("%Y-%m-%d %H:%M:%S")
        })
    return commits

def get_commit_diff(repo, commit_id):
    commit = repo[commit_id]
    parent_id = commit.parents[0] if commit.parents else ZERO_SHA
    parent_tree = repo[parent_id].tree if parent_id != ZERO_SHA else None
    commit_tree = commit.tree
    
    changes = list(tree_changes(repo.object_store, parent_tree, commit_tree))
    diff_lines = []
    for (oldpath, newpath), (oldmode, newmode), (oldsha, newsha) in changes:
        oldpath = oldpath.decode() if oldpath else ""
        newpath = newpath.decode() if newpath else ""
        if oldsha == newsha:
            continue
        diff_lines.append(f"diff --git a/{oldpath or newpath} b/{newpath or oldpath}")
        if oldsha == ZERO_SHA:
            diff_lines.append("new file mode 100644")
            diff_lines.append("--- /dev/null")
            diff_lines.append(f"+++ b/{newpath}")
            blob = repo[newsha]
            for line in blob.data.decode("utf-8", errors="replace").splitlines():
                diff_lines.append(f"+{line}")
        elif newsha == ZERO_SHA:
            diff_lines.append("deleted file mode 100644")
            diff_lines.append(f"--- a/{oldpath}")
            diff_lines.append("+++ /dev/null")
            blob = repo[oldsha]
            for line in blob.data.decode("utf-8", errors="replace").splitlines():
                diff_lines.append(f"-{line}")
        else:
            diff_lines.append(f"--- a/{oldpath}")
            diff_lines.append(f"+++ b/{newpath}")
            old_blob = repo[oldsha]
            new_blob = repo[newsha]
            old_lines = old_blob.data.decode("utf-8", errors="replace").splitlines()
            new_lines = new_blob.data.decode("utf-8", errors="replace").splitlines()
            import difflib
            for line in difflib.unified_diff(old_lines, new_lines, lineterm=""):
                if line.startswith("---") or line.startswith("+++") or line.startswith("@@"):
                    diff_lines.append(line)
                elif line.startswith("+"):
                    diff_lines.append(f"<span class='diff-add'>{line}</span>")
                elif line.startswith("-"):
                    diff_lines.append(f"<span class='diff-del'>{line}</span>")
                else:
                    diff_lines.append(line)
    return "\n".join(diff_lines)

def build_breadcrumb(repo_name, path_parts):
    breadcrumb = []
    current = ""
    for part in path_parts:
        current = f"{current}/{part}" if current else part
        breadcrumb.append({
            "name": part,
            "url": f"/{repo_name}/tree/HEAD/{current}"
        })
    return breadcrumb

@app.route("/")
def index():
    repos = list_repos()
    return render_template_string(HTML_TEMPLATE, repos=repos)

@app.route("/api/repos", methods=["POST"])
def create_repo():
    data = request.get_json() or {}
    name = data.get("name") or request.form.get("name")
    if not name:
        return jsonify({"error": "name required"}), 400
    name = name.strip().replace("/", "-")
    repo_path = get_repo_path(name)
    if repo_path.exists():
        return jsonify({"error": "repository exists"}), 400
    Repo.init_bare(str(repo_path))
    return jsonify({"name": name, "url": f"/{name}"}), 201

@app.route("/api/repos/<name>/delete", methods=["POST"])
def delete_repo(name):
    repo_path = get_repo_path(name)
    if repo_path.exists():
        shutil.rmtree(repo_path)
    return jsonify({"ok": True})

@app.route("/<repo_name>")
def repo_home(repo_name):
    repo = open_repo(repo_name)
    if not repo:
        abort(404)
    head = repo.head()
    try:
        tree_id = repo[head].tree
    except:
        tree_id = None
    return repo_tree(repo_name, tree_id.decode() if tree_id else "HEAD", "")

@app.route("/<repo_name>/tree/<tree_id>/<path:path>")
@app.route("/<repo_name>/tree/<tree_id>")
def repo_tree(repo_name, tree_id, path=""):
    repo = open_repo(repo_name)
    if not repo:
        abort(404)
    try:
        tree_obj = repo[tree_id.encode() if len(tree_id) == 40 else tree_id]
        if not isinstance(tree_obj, Tree):
            tree_obj = repo[repo[tree_id.encode() if len(tree_id) == 40 else tree_id].tree]
    except:
        abort(404)
    items = get_tree(repo, tree_obj.id, path)
    path_parts = [p for p in path.split("/") if p]
    breadcrumb = build_breadcrumb(repo_name, path_parts)
    return render_template_string(HTML_TEMPLATE, 
        repo_name=repo_name, view="tree", tree_items=items, breadcrumb=breadcrumb)

@app.route("/<repo_name>/blob/<blob_id>/<path:path>")
def repo_blob(repo_name, blob_id, path):
    repo = open_repo(repo_name)
    if not repo:
        abort(404)
    content = get_blob_content(repo, blob_id.encode() if len(blob_id) == 40 else blob_id)
    path_parts = [p for p in path.split("/") if p]
    breadcrumb = build_breadcrumb(repo_name, path_parts[:-1])
    return render_template_string(HTML_TEMPLATE,
        repo_name=repo_name, view="blob", blob_path=path, blob_content=content, breadcrumb=breadcrumb)

@app.route("/<repo_name>/log")
def repo_log(repo_name):
    repo = open_repo(repo_name)
    if not repo:
        abort(404)
    commits = get_commits(repo)
    breadcrumb = [{"name": "log", "url": None}]
    return render_template_string(HTML_TEMPLATE,
        repo_name=repo_name, view="log", commits=commits, breadcrumb=breadcrumb)

@app.route("/<repo_name>/commit/<commit_id>")
def repo_commit(repo_name, commit_id):
    repo = open_repo(repo_name)
    if not repo:
        abort(404)
    try:
        commit = repo[commit_id.encode() if len(commit_id) == 40 else commit_id]
    except:
        abort(404)
    diff = get_commit_diff(repo, commit.id)
    commit_info = {
        "id": commit.id.decode(),
        "message": commit.message.decode().strip(),
        "author": commit.author.decode(),
        "date": datetime.fromtimestamp(commit.commit_time).strftime("%Y-%m-%d %H:%M:%S")
    }
    breadcrumb = [{"name": "log", "url": f"/{repo_name}/log"}, {"name": commit_id[:8], "url": None}]
    return render_template_string(HTML_TEMPLATE,
        repo_name=repo_name, view="commit", commit=commit_info, commit_diff=diff, breadcrumb=breadcrumb)

def scan_and_fix_repos():
    while True:
        time.sleep(60)
        if not OPENROUTER_API_KEY:
            continue
        for repo_name in list_repos():
            try:
                fix_repo_sorry_todo(repo_name)
            except Exception as e:
                print(f"Error fixing {repo_name}: {e}", file=sys.stderr)

def fix_repo_sorry_todo(repo_name):
    repo = open_repo(repo_name)
    if not repo:
        return
    head = repo.head()
    try:
        head_commit = repo[head]
        tree_id = head_commit.tree
    except:
        return
    
    files_to_fix = []
    collect_files(repo, tree_id, "", files_to_fix)
    
    if not files_to_fix:
        return
    
    for file_path, blob_id in files_to_fix:
        content = get_blob_content(repo, blob_id)
        if "sorry" not in content.lower() and "todo" not in content.lower():
            continue
        
        fixed_content = call_openrouter(file_path, content)
        if fixed_content and fixed_content != content:
            commit_fix(repo, repo_name, file_path, blob_id, fixed_content, head_commit)

def collect_files(repo, tree_id, prefix, result):
    tree = repo[tree_id]
    for entry in tree.items():
        obj = repo[entry.sha]
        path = f"{prefix}/{entry.path.decode()}" if prefix else entry.path.decode()
        if isinstance(obj, Tree):
            collect_files(repo, entry.sha, path, result)
        elif isinstance(obj, Blob):
            result.append((path, entry.sha))

def call_openrouter(file_path, content):
    prompt = f"""Fix the following code file. Replace any 'sorry' or 'TODO' comments with proper implementations.
Only output the fixed file content, no explanations, no markdown.

File: {file_path}

```{content}```"""
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 8192
    }
    
    try:
        resp = requests.post(OPENROUTER_URL, headers=headers, json=data, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        fixed = result["choices"][0]["message"]["content"]
        if fixed.startswith("```") and fixed.endswith("```"):
            lines = fixed.split("\n")
            fixed = "\n".join(lines[1:-1])
        return fixed
    except Exception as e:
        print(f"OpenRouter error: {e}", file=sys.stderr)
        return None

def commit_fix(repo, repo_name, file_path, old_blob_id, new_content, parent_commit):
    tree_id = parent_commit.tree
    tree = repo[tree_id]
    
    path_parts = file_path.split("/")
    new_tree_id = update_tree_recursive(repo, tree, path_parts, 0, new_content.encode())
    
    author = f"Auto Fix <bot@gitserver>".encode()
    commit = Commit()
    commit.tree = new_tree_id
    commit.parents = [parent_commit.id]
    commit.author = author
    commit.committer = author
    commit.commit_time = int(time.time())
    commit.commit_timezone = 0
    commit.encoding = b"UTF-8"
    commit.message = f"Auto-fix: resolve sorry/TODO in {file_path}\n".encode()
    
    repo.object_store.add_object(commit)
    repo.refs[b"refs/heads/master"] = commit.id
    
    print(f"Committed fix for {file_path} in {repo_name}: {commit.id.decode()[:8]}")

def update_tree_recursive(repo, tree, path_parts, index, new_content):
    if index == len(path_parts) - 1:
        blob = Blob.from_string(new_content)
        repo.object_store.add_object(blob)
        new_items = list(tree.items())
        for i, entry in enumerate(new_items):
            if entry.path.decode() == path_parts[index]:
                new_items[i] = entry._replace(sha=blob.id, mode=0o100644)
                break
        else:
            from dulwich.objects import TreeEntry
            new_items.append(TreeEntry(0o100644, path_parts[index].encode(), blob.id))
        new_tree = Tree()
        for entry in new_items:
            new_tree.add(entry.path, entry.mode, entry.sha)
        repo.object_store.add_object(new_tree)
        return new_tree.id
    
    subtree_id = None
    for entry in tree.items():
        if entry.path.decode() == path_parts[index]:
            subtree_id = entry.sha
            break
    
    if not subtree_id:
        return tree.id
    
    subtree = repo[subtree_id]
    new_subtree_id = update_tree_recursive(repo, subtree, path_parts, index + 1, new_content)
    
    new_items = list(tree.items())
    for i, entry in enumerate(new_items):
        if entry.path.decode() == path_parts[index]:
            new_items[i] = entry._replace(sha=new_subtree_id)
            break
    
    new_tree = Tree()
    for entry in new_items:
        new_tree.add(entry.path, entry.mode, entry.sha)
    repo.object_store.add_object(new_tree)
    return new_tree.id

class CombinedApp:
    def __init__(self, flask_app, git_wsgi):
        self.flask_app = flask_app
        self.git_wsgi = git_wsgi
    
    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path.startswith("/git/") or path == "/git" or path.startswith("/info/refs") or path.startswith("/git-upload-pack") or path.startswith("/git-receive-pack"):
            environ["PATH_INFO"] = path[4:] if path.startswith("/git") else path
            return self.git_wsgi(environ, start_response)
        return self.flask_app(environ, start_response)

if __name__ == "__main__":
    from werkzeug.serving import run_simple
    
    scanner_thread = threading.Thread(target=scan_and_fix_repos, daemon=True)
    scanner_thread.start()
    
    combined = CombinedApp(app, git_wsgi)
    print("Starting Git server on http://localhost:7777")
    print("Git HTTP endpoint: http://localhost:7777/git/<repo>.git")
    run_simple("0.0.0.0", 7777, combined, use_reloader=False, threaded=True)