use crate::ast::*;
use crate::lexer::{Token, TokenKind};

pub fn parse(tokens: &[Token]) -> Result<Program, String> { Parser { tokens, pos: 0 }.program() }
struct Parser<'a> { tokens: &'a [Token], pos: usize }
impl<'a> Parser<'a> {
 fn cur(&self)->&Token{&self.tokens[self.pos]}
 fn bump(&mut self){if self.pos+1<self.tokens.len(){self.pos+=1}}
 fn word(&mut self,e:&str)->Result<(),String>{match &self.cur().kind{TokenKind::Word(w) if w==e=>{self.bump();Ok(())},_=>Err(self.err(&format!("expected '{e}'")))}}
 fn ident(&mut self)->Result<String,String>{match self.cur().kind.clone(){TokenKind::Word(w)=>{self.bump();Ok(w)},_=>Err(self.err("expected identifier"))}}
 fn expect(&mut self,k:TokenKind)->Result<(),String>{if self.cur().kind==k{self.bump();Ok(())}else{Err(self.err(&format!("expected {:?}",k)))}}
 fn err(&self,s:&str)->String{format!("error[E0002]: {s} at {}:{}",self.cur().line,self.cur().column)}
 fn program(&mut self)->Result<Program,String>{let mut items=Vec::new();while self.cur().kind!=TokenKind::Eof{match &self.cur().kind{TokenKind::Word(w) if w=="intent"=>items.push(Item::Intent(self.intent()?)),TokenKind::Word(w) if w=="policy"=>items.push(Item::Policy(self.policy()?)),TokenKind::Word(w) if w=="adapter"=>items.push(Item::Adapter(self.adapter()?)),_=>return Err(self.err("expected intent, policy, or adapter"))}}Ok(Program{items})}
 fn intent(&mut self)->Result<IntentDecl,String>{self.word("intent")?;let name=self.ident()?;self.expect(TokenKind::LBrace)?;let mut fields=Vec::new();while self.cur().kind!=TokenKind::RBrace{let n=self.ident()?;self.expect(TokenKind::Colon)?;let t=self.ident()?;self.expect(TokenKind::Semicolon)?;fields.push(Field{name:n,ty:t})}self.expect(TokenKind::RBrace)?;Ok(IntentDecl{name,fields})}
 fn policy(&mut self)->Result<PolicyDecl,String>{self.word("policy")?;let name=self.ident()?;self.word("for")?;let target_intent=self.ident()?;let body=self.body()?;Ok(PolicyDecl{name,target_intent,body})}
 fn adapter(&mut self)->Result<AdapterDecl,String>{self.word("adapter")?;let name=self.ident()?;self.word("for")?;let target_intent=self.ident()?;self.expect(TokenKind::LBrace)?;self.word("timeout")?;self.expect(TokenKind::Colon)?;let timeout_ms=self.num()?;self.word("ms")?;self.expect(TokenKind::Comma)?;self.word("max_retries")?;self.expect(TokenKind::Colon)?;let max_retries=self.num()?;self.expect(TokenKind::Comma)?;self.word("execute")?;self.expect(TokenKind::LParen)?;self.word("fenced")?;self.word("Lease")?;self.expect(TokenKind::Lt)?;let lease_intent=self.ident()?;self.expect(TokenKind::Gt)?;let lease_name=self.ident()?;self.expect(TokenKind::RParen)?;if lease_intent!=target_intent{return Err(self.err("Lease<T> intent does not match adapter target"))}let body=self.body()?;Ok(AdapterDecl{name,target_intent,timeout_ms,max_retries,lease_name,body})}
 fn num<T:std::str::FromStr>(&mut self)->Result<T,String>{match self.cur().kind.clone(){TokenKind::Number(n)=>{self.bump();n.parse().map_err(|_|self.err("invalid number"))},_=>Err(self.err("expected number"))}}
 fn body(&mut self)->Result<Vec<Stmt>,String>{self.expect(TokenKind::LBrace)?;let mut body=Vec::new();while self.cur().kind!=TokenKind::RBrace{let name=self.ident()?;self.expect(TokenKind::Dot)?;let op=self.ident()?;self.expect(TokenKind::LParen)?;self.skip_parens()?;self.expect(TokenKind::Semicolon)?;match op.as_str(){"commit"=>body.push(Stmt::Commit(name)),"abort"=>body.push(Stmt::Abort(name)),_=>body.push(Stmt::Use(name))}}self.expect(TokenKind::RBrace)?;Ok(body)}
 fn skip_parens(&mut self)->Result<(),String>{let mut d=1usize;while d>0{match self.cur().kind{TokenKind::LParen=>d+=1,TokenKind::RParen=>d-=1,TokenKind::Eof=>return Err(self.err("unterminated call")),_=>{}}if d>0{self.bump()}}self.bump();Ok(())}
}
