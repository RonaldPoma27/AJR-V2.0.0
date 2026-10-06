#!/usr/bin/env python3
"""Chequeo de traducciones (correr desde frontend/):  python3 check_i18n.py [--spanish]

1. es y en tienen EXACTAMENTE las mismas claves y los mismos {{placeholders}}.
2. Cada t("clave.literal") usada en src/ existe en es (las dinámicas con ${} se saltean).
3. --spanish: lista líneas de .tsx/.ts que aún tienen texto en español sin traducir
   (acentos, ¿ ¡, o palabras comunes dentro de strings/JSX). Heurístico: revisar a mano.
"""
import json, re, sys, glob, os

root = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, "src")

def load(lang):
    d = json.load(open(f"{src}/i18n/{lang}.json", encoding="utf-8"))
    for f in sorted(glob.glob(f"{src}/i18n/parts/*.{lang}.json")):
        for k, v in json.load(open(f, encoding="utf-8")).items():
            if k in d:
                print(f"DUPLICADA: clave de primer nivel '{k}' (archivo {os.path.basename(f)})")
            d[k] = v
    return d

def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, f"{p}{k}.")
        else:
            yield f"{p}{k}", v

es, en = dict(flat(load("es"))), dict(flat(load("en")))
errors = 0
for k in sorted(set(es) ^ set(en)):
    print(f"FALTA en {'en' if k in es else 'es'}: {k}"); errors += 1
ph = lambda s: sorted(re.findall(r"\{\{\s*\w+\s*\}\}", s))
for k in sorted(set(es) & set(en)):
    if not isinstance(es[k], str) or not isinstance(en[k], str):
        print(f"TIPO raro: {k}"); errors += 1; continue
    if ph(es[k]) != ph(en[k]):
        print(f"PLACEHOLDERS distintos: {k}: {ph(es[k])} vs {ph(en[k])}"); errors += 1
    if not en[k].strip():
        print(f"VACÍA en en: {k}"); errors += 1

keys = set(es)
prefixes = {k.rsplit(".", 1)[0] for k in keys}
used = re.compile(r"""\bt\(\s*(["'])([A-Za-z0-9_.]+)\1""")
for path in glob.glob(f"{src}/**/*.ts*", recursive=True):
    text = open(path, encoding="utf-8").read()
    for m in used.finditer(text):
        k = m.group(2)
        # i18next con plurales usa k_one/k_other; con defaultValue se tolera la ausencia
        window = text[m.end(): m.end() + 120]
        if k in keys or any(x.startswith(k + "_") for x in keys) or "defaultValue" in window:
            continue
        print(f"CLAVE inexistente: {k}  ({os.path.relpath(path, root)})"); errors += 1

if "--spanish" in sys.argv:
    accent = re.compile(r"[áéíóúñÁÉÍÓÚÑ¿¡]")
    words = re.compile(r"\b(Cargando|Error|Guardar|Cancelar|Enviar|Pedido|Nombre|Volver|Reintentar|Contraseña|Todos|Ver|Editar|Borrar|Eliminar|Crear|No hay|Probá|Revisá)\b")
    for path in sorted(glob.glob(f"{src}/**/*.ts*", recursive=True)):
        if "/i18n/" in path:
            continue
        for n, line in enumerate(open(path, encoding="utf-8"), 1):
            s = line.strip()
            if s.startswith(("//", "*", "/*", "{/*")):
                continue
            code = re.sub(r"//.*$", "", s)
            if accent.search(code) or words.search(code):
                print(f"ESPAÑOL? {os.path.relpath(path, root)}:{n}: {s[:110]}")

print("OK" if not errors else f"{errors} problema(s)")
sys.exit(1 if errors else 0)
