#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TokenKind {
    Word(String), Number(String), LBrace, RBrace, LParen, RParen,
    Colon, Comma, Semicolon, Lt, Gt, Eof,
}

#[derive(Debug, Clone)]
pub struct Token { pub kind: TokenKind, pub line: usize, pub column: usize }

pub fn lex(src: &str) -> Result<Vec<Token>, String> {
    let mut out = Vec::new();
    let mut chars = src.chars().peekable();
    let mut line = 1usize;
    let mut col = 1usize;
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() { chars.next(); if c == '\n' { line += 1; col = 1; } else { col += 1; } continue; }
        if c == '/' { chars.next(); if chars.peek() == Some(&'/') { while let Some(ch) = chars.next() { if ch == '\n' { line += 1; col = 1; break; } col += 1; } continue; } return Err(format!("error[E0001]: unexpected '/' at {line}:{col}")); }
        let l = line; let c0 = col;
        if c.is_ascii_alphabetic() || c == '_' {
            let mut s = String::new();
            while let Some(&ch) = chars.peek() { if ch.is_ascii_alphanumeric() || ch == '_' { s.push(ch); chars.next(); col += 1; } else { break; } }
            out.push(Token { kind: TokenKind::Word(s), line: l, column: c0 }); continue;
        }
        if c.is_ascii_digit() {
            let mut s = String::new();
            while let Some(&ch) = chars.peek() { if ch.is_ascii_digit() { s.push(ch); chars.next(); col += 1; } else { break; } }
            out.push(Token { kind: TokenKind::Number(s), line: l, column: c0 }); continue;
        }
        let kind = match c { '{'=>TokenKind::LBrace, '}'=>TokenKind::RBrace, '('=>TokenKind::LParen, ')'=>TokenKind::RParen, ':'=>TokenKind::Colon, ','=>TokenKind::Comma, ';'=>TokenKind::Semicolon, '<'=>TokenKind::Lt, '>'=>TokenKind::Gt, _=>return Err(format!("error[E0001]: unexpected '{c}' at {line}:{col}")) };
        chars.next(); col += 1; out.push(Token { kind, line:l, column:c0 });
    }
    out.push(Token { kind:TokenKind::Eof, line, column:col }); Ok(out)
}
