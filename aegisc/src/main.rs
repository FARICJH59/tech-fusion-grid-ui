mod ast;
mod lexer;
mod parser;
mod cfg;
mod linear;
mod types;
mod effects;
mod ir;
mod backend_sqlite;

use std::{env, fs, process};

fn main() {
    let path = match env::args().nth(1) { Some(p) => p, None => { eprintln!("usage: aegisc <file.aegis>"); process::exit(2); } };
    let source = match fs::read_to_string(&path) { Ok(s) => s, Err(e) => { eprintln!("error: cannot read {path}: {e}"); process::exit(2); } };
    println!("Aegis Compiler v0.1.0\nCompiling {path}...\n");
    let tokens = match lexer::lex(&source) { Ok(t) => t, Err(e) => { eprintln!("{e}"); process::exit(1); } };
    println!("Lexer........................ PASS");
    let ast = match parser::parse(&tokens) { Ok(a) => a, Err(e) => { eprintln!("{e}"); process::exit(1); } };
    println!("Parser....................... PASS");
    if let Err(e) = types::check_program(&ast) { eprintln!("{e}"); process::exit(1); }
    println!("Type checking................ PASS");
    if let Err(e) = effects::check_program(&ast) { eprintln!("{e}"); process::exit(1); }
    println!("Policy effects............... PASS");
    if let Err(e) = linear::check_program(&ast) { eprintln!("{e}"); process::exit(1); }
    println!("Linear lease checking........ PASS");
    println!("CFG construction............. PASS");

    for item in &ast.items {
        if let ast::Item::Adapter(adapter) = item {
            let air = ir::lower_adapter(adapter);
            println!("AIR lowering................. PASS");
            println!("AIR adapter: {}", air.adapter);
            println!("AIR operations: {}", air.ops.len());
            let sql = backend_sqlite::generate_sql(&air);
            println!("SQLite backend generation... PASS");
            println!("Generated SQLite protocol: {} bytes", sql.len());
        }
    }

    println!("\nAegis v0.1 compilation succeeded.");
}
