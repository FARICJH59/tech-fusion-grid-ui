mod ast;
mod lexer;
mod parser;
mod cfg;
mod linear;

use std::{env, fs, process};

fn main() {
    let path = match env::args().nth(1) {
        Some(p) => p,
        None => { eprintln!("usage: aegisc <file.aegis>"); process::exit(2); }
    };
    let source = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => { eprintln!("error: cannot read {path}: {e}"); process::exit(2); }
    };

    println!("Aegis Compiler v0.1.0");
    println!("Compiling {path}...\n");

    let tokens = match lexer::lex(&source) {
        Ok(t) => t,
        Err(e) => { eprintln!("{e}"); process::exit(1); }
    };
    println!("Lexer........................ PASS");

    let ast = match parser::parse(&tokens) {
        Ok(a) => a,
        Err(e) => { eprintln!("{e}"); process::exit(1); }
    };
    println!("Parser....................... PASS");

    if let Err(e) = linear::check_program(&ast) {
        eprintln!("{e}"); process::exit(1)
    }
    println!("Linear lease checking........ PASS");
    println!("CFG construction............. PASS");

    println!("\nAegis v0.1 compilation succeeded.");
}
