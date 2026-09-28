#property strict
#property version "0.10"
#property description "BBP read-only account snapshot collector. No trade execution."

input string ApiOrigin="https://api.example.invalid";
input string ConnectionToken="";
input int SyncIntervalSeconds=30;

string origin,initial_login,initial_server,pending="";
bool bound=false,stopped=false;
ulong next_attempt=0;
int retry_seconds=5;

string Quote(string value)
{
 string result="\"";
 for(int i=0;i<StringLen(value);i++)
 {
  ushort c=StringGetCharacter(value,i);
  if(c==34) result+="\\\"";
  else if(c==92) result+="\\\\";
  else if(c<32) result+=StringFormat("\\u%04X",(int)c);
  else result+=StringSubstr(value,i,1);
 }
 return result+"\"";
}
string Identity()
{
 return "\"platform\":\"MT5\",\"collectorVersion\":\"0.1.0\",\"accountLogin\":"+Quote(initial_login)+
        ",\"brokerServer\":"+Quote(initial_server)+",\"currency\":"+Quote(AccountInfoString(ACCOUNT_CURRENCY));
}
string UtcNow()
{
 MqlDateTime t; TimeToStruct(TimeGMT(),t);
 return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",t.year,t.mon,t.day,t.hour,t.min,t.sec);
}
int Send(string endpoint,string body)
{
 char data[],response[]; string response_headers;
 int count=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
 if(count>0) ArrayResize(data,count-1); // Exclude terminating NUL from JSON.
 string headers="Content-Type: application/json\r\nAuthorization: Bearer "+ConnectionToken+"\r\n";
 ResetLastError();
 int code=WebRequest("POST",origin+"/api/collector/v1/"+endpoint,headers,5000,data,response,response_headers);
 if(code==-1) PrintFormat("BBP network error %d. Check HTTPS URL whitelist and connectivity.",GetLastError());
 else PrintFormat("BBP %s HTTP %d",endpoint,code);
 // Never log token, account payload, or response contents.
 return code;
}
int OnInit()
{
 origin=ApiOrigin;
 while(StringLen(origin)>0 && StringSubstr(origin,StringLen(origin)-1)=="/") origin=StringSubstr(origin,0,StringLen(origin)-1);
 if(StringFind(origin,"https://")!=0 || StringFind(origin,".invalid")>=0 || SyncIntervalSeconds<15) return INIT_PARAMETERS_INCORRECT;
 if(StringLen(ConnectionToken)!=47 || StringSubstr(ConnectionToken,0,4)!="BBP_") return INIT_PARAMETERS_INCORRECT;
 for(int i=4;i<StringLen(ConnectionToken);i++)
 {
  ushort c=StringGetCharacter(ConnectionToken,i);
  if(!((c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c==95||c==45)) return INIT_PARAMETERS_INCORRECT;
 }
 initial_login=(string)AccountInfoInteger(ACCOUNT_LOGIN);
 initial_server=AccountInfoString(ACCOUNT_SERVER);
 if(initial_login=="0" || initial_server=="") return INIT_FAILED;
 if(!EventSetTimer(1)) return INIT_FAILED;
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){EventKillTimer();}
void OnTimer()
{
 if(stopped || GetTickCount64()<next_attempt) return;
 if(initial_login!=(string)AccountInfoInteger(ACCOUNT_LOGIN) || initial_server!=AccountInfoString(ACCOUNT_SERVER))
 {stopped=true;Print("BBP stopped: account changed. Reconnect intentionally with the correct token.");return;}
 if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
 string endpoint=bound?"sync":"handshake";
 if(bound && pending=="")
 {
  double balance=AccountInfoDouble(ACCOUNT_BALANCE),equity=AccountInfoDouble(ACCOUNT_EQUITY);
  if(!MathIsValidNumber(balance)||!MathIsValidNumber(equity)) return;
  pending="{"+Identity()+",\"snapshot\":{\"capturedAt\":"+Quote(UtcNow())+",\"balance\":"+DoubleToString(balance,8)+",\"equity\":"+DoubleToString(equity,8)+"}}";
 }
 int code=Send(endpoint,bound?pending:"{"+Identity()+"}");
 if(code>=200 && code<300)
 {
  bool first=!bound; bound=true;pending="";retry_seconds=5;
  next_attempt=GetTickCount64()+(ulong)(first?2:SyncIntervalSeconds)*1000;
 }
 else if(code==400||code==401||code==409||code==413||code==415)
 {stopped=true;Print("BBP stopped: configuration, authorization or binding rejected. Review API setup before reattaching.");}
 else
 {next_attempt=GetTickCount64()+(ulong)retry_seconds*1000;retry_seconds=MathMin(retry_seconds*2,300);}
}
