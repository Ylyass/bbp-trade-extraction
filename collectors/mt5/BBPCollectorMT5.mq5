#property strict
#property version "0.210"
#property description "BBP read-only account, position and closed-deal collector. No trade execution."

input string ApiOrigin="https://api.example.invalid";
input string ConnectionToken="";
input int SyncIntervalSeconds=30;

string origin,initial_login,initial_server,pending="";
bool bound=false,stopped=false;
ulong next_attempt=0;
int retry_seconds=5;

// Each request is deliberately small, staying below the API's 16 KiB safety limit.
const int POSITION_PAGE_SIZE=4;
const int DEAL_BATCH_SIZE=4;
const int MAX_POSITION_PAGES=128;
const int HISTORY_LOOKBACK_SECONDS=604800; // Seven days; backend upserts repeated events safely.
int pending_kind=0; // 0=snapshot only, 1=positions, 2=closed deals
int next_kind=1;
bool position_frame_active=false;
string position_frame_id="";
int position_frame_total=0,position_page=0,position_page_count=1;

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
 return "\"platform\":\"MT5\",\"collectorVersion\":\"0.210\",\"accountLogin\":"+Quote(initial_login)+
        ",\"brokerServer\":"+Quote(initial_server)+",\"currency\":"+Quote(AccountInfoString(ACCOUNT_CURRENCY));
}
string UtcNow()
{
 MqlDateTime t; TimeToStruct(TimeGMT(),t);
 return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",t.year,t.mon,t.day,t.hour,t.min,t.sec);
}

string SnapshotJson()
{
 double balance=AccountInfoDouble(ACCOUNT_BALANCE),equity=AccountInfoDouble(ACCOUNT_EQUITY);
 double floating_pl=AccountInfoDouble(ACCOUNT_PROFIT),margin=AccountInfoDouble(ACCOUNT_MARGIN);
 double free_margin=AccountInfoDouble(ACCOUNT_MARGIN_FREE),margin_level=AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
 if(!MathIsValidNumber(balance)||!MathIsValidNumber(equity)||!MathIsValidNumber(floating_pl)||!MathIsValidNumber(margin)||!MathIsValidNumber(free_margin)||!MathIsValidNumber(margin_level)) return "";
 return "\"snapshot\":{\"capturedAt\":"+Quote(UtcNow())+",\"balance\":"+DoubleToString(balance,8)+",\"equity\":"+DoubleToString(equity,8)+",\"floatingPl\":"+DoubleToString(floating_pl,8)+",\"margin\":"+DoubleToString(margin,8)+",\"freeMargin\":"+DoubleToString(free_margin,8)+",\"marginLevel\":"+DoubleToString(margin_level,8)+"}";
}

bool BeginPositionFrame()
{
 position_frame_total=PositionsTotal();
 if(position_frame_total>POSITION_PAGE_SIZE*MAX_POSITION_PAGES)
 {
  Print("BBP positions skipped: too many open positions for one safe frame.");
  return false;
 }
 position_page_count=MathMax(1,(position_frame_total+POSITION_PAGE_SIZE-1)/POSITION_PAGE_SIZE);
 position_page=0;
 position_frame_id="p_"+(string)TimeCurrent()+"_"+(string)GetTickCount64();
 position_frame_active=true;
 return true;
}

string PositionSide(long position_type){return position_type==POSITION_TYPE_SELL ? "sell" : "buy";}

string BuildPositionsSection()
{
 if(!position_frame_active && !BeginPositionFrame()) return "";
 int start=position_page*POSITION_PAGE_SIZE;
 int end=(int)MathMin(start+POSITION_PAGE_SIZE,position_frame_total);
 string items="";
 for(int i=start;i<end;i++)
 {
  ulong ticket=PositionGetTicket(i);
  if(ticket==0 || !PositionSelectByTicket(ticket)) continue;
  if(items!="") items+=",";
  long position_id=PositionGetInteger(POSITION_IDENTIFIER);
  long opened_msc=PositionGetInteger(POSITION_TIME_MSC);
  long updated_msc=PositionGetInteger(POSITION_TIME_UPDATE_MSC);
  items+="{\"positionId\":"+Quote((string)position_id)+",\"ticket\":"+Quote((string)ticket)+",\"symbol\":"+Quote(PositionGetString(POSITION_SYMBOL))+",\"side\":"+Quote(PositionSide(PositionGetInteger(POSITION_TYPE)))+",\"volume\":"+DoubleToString(PositionGetDouble(POSITION_VOLUME),8)+",\"openPrice\":"+DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN),8)+",\"currentPrice\":"+DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT),8)+",\"stopLoss\":"+DoubleToString(PositionGetDouble(POSITION_SL),8)+",\"takeProfit\":"+DoubleToString(PositionGetDouble(POSITION_TP),8)+",\"openedAtMsc\":"+Quote((string)opened_msc)+",\"updatedAtMsc\":"+Quote((string)updated_msc)+",\"profit\":"+DoubleToString(PositionGetDouble(POSITION_PROFIT),8)+",\"swap\":"+DoubleToString(PositionGetDouble(POSITION_SWAP),8)+"}";
 }
 return "\"positions\":{\"frameId\":"+Quote(position_frame_id)+",\"capturedAt\":"+Quote(UtcNow())+",\"pageIndex\":"+(string)position_page+",\"pageCount\":"+(string)position_page_count+",\"items\":["+items+"]}";
}

string EntryName(long entry)
{
 if(entry==DEAL_ENTRY_OUT) return "out";
 if(entry==DEAL_ENTRY_OUT_BY) return "outBy";
 return "inout";
}
string DealTypeName(long deal_type){return deal_type==DEAL_TYPE_SELL ? "sell" : "buy";}
string DealReasonName(long reason)
{
 if(reason==DEAL_REASON_CLIENT) return "client";
 if(reason==DEAL_REASON_MOBILE) return "mobile";
 if(reason==DEAL_REASON_WEB) return "web";
 if(reason==DEAL_REASON_EXPERT) return "expert";
 if(reason==DEAL_REASON_SL) return "stopLoss";
 if(reason==DEAL_REASON_TP) return "takeProfit";
 if(reason==DEAL_REASON_SO) return "stopOut";
 if(reason==DEAL_REASON_DEALER) return "dealer";
 if(reason==DEAL_REASON_ROLLOVER) return "rollover";
 return "unknown";
}

string DealItem(ulong ticket)
{
 long time_msc=HistoryDealGetInteger(ticket,DEAL_TIME_MSC);
 long deal_type=HistoryDealGetInteger(ticket,DEAL_TYPE);
 long entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);
 return "{\"dealId\":"+Quote((string)ticket)+",\"orderId\":"+Quote((string)HistoryDealGetInteger(ticket,DEAL_ORDER))+",\"positionId\":"+Quote((string)HistoryDealGetInteger(ticket,DEAL_POSITION_ID))+",\"timeMsc\":"+Quote((string)time_msc)+",\"symbol\":"+Quote(HistoryDealGetString(ticket,DEAL_SYMBOL))+",\"dealType\":"+Quote(DealTypeName(deal_type))+",\"entry\":"+Quote(EntryName(entry))+",\"reason\":"+Quote(DealReasonName(HistoryDealGetInteger(ticket,DEAL_REASON)))+",\"volume\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_VOLUME),8)+",\"price\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_PRICE),8)+",\"profit\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_PROFIT),8)+",\"commission\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_COMMISSION),8)+",\"swap\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_SWAP),8)+",\"fee\":"+DoubleToString(HistoryDealGetDouble(ticket,DEAL_FEE),8)+"}";
}

string BuildDealsSection()
{
 datetime to_time=TimeCurrent();
 string items="";
 if(!HistorySelect(to_time-HISTORY_LOOKBACK_SECONDS,to_time)) return "\"deals\":{\"mode\":\"incremental\",\"complete\":false,\"items\":[]}";
 ulong tickets[]; long times[]; int count=0;
 for(int i=0;i<HistoryDealsTotal();i++)
 {
  ulong ticket=HistoryDealGetTicket(i);
  if(ticket==0) continue;
  long deal_type=HistoryDealGetInteger(ticket,DEAL_TYPE),entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);
  if((deal_type!=DEAL_TYPE_BUY && deal_type!=DEAL_TYPE_SELL) || (entry!=DEAL_ENTRY_OUT && entry!=DEAL_ENTRY_OUT_BY && entry!=DEAL_ENTRY_INOUT)) continue;
  ArrayResize(tickets,count+1); ArrayResize(times,count+1);
  tickets[count]=ticket; times[count]=HistoryDealGetInteger(ticket,DEAL_TIME_MSC); count++;
 }
 bool used[]; ArrayResize(used,count);
 for(int emitted=0;emitted<DEAL_BATCH_SIZE;emitted++)
 {
  int best=-1;
  for(int i=0;i<count;i++) if(!used[i] && (best<0 || times[i]>times[best] || (times[i]==times[best] && tickets[i]>tickets[best]))) best=i;
  if(best<0) break;
  used[best]=true;
  if(items!="") items+=",";
  items+=DealItem(tickets[best]);
 }
 return "\"deals\":{\"mode\":\"incremental\",\"complete\":true,\"items\":["+items+"]}";
}

string BuildSyncPayload()
{
 string snapshot=SnapshotJson();
 if(snapshot=="") return "";
 pending_kind=0;
 string section="";
 if(position_frame_active || next_kind==1)
 {
  section=BuildPositionsSection();
  if(section!="") pending_kind=1; else next_kind=2;
 }
 if(section=="" && next_kind==2){section=BuildDealsSection();pending_kind=2;}
 return "{"+Identity()+","+snapshot+(section=="" ? "" : ","+section)+"}";
}

void AdvanceTradeSection()
{
 if(pending_kind==1)
 {
  position_page++;
  if(position_page>=position_page_count){position_frame_active=false;next_kind=2;}
 }
 else if(pending_kind==2) next_kind=1;
 pending_kind=0;
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
  pending=BuildSyncPayload();
  if(pending=="") return;
 }
 int code=Send(endpoint,bound?pending:"{"+Identity()+"}");
 if(code>=200 && code<300)
 {
  bool first=!bound; bound=true;pending="";retry_seconds=5;
  if(!first) AdvanceTradeSection();
  next_attempt=GetTickCount64()+(ulong)(first?2:SyncIntervalSeconds)*1000;
 }
 else if(code==400||code==401||code==409||code==413||code==415)
 {stopped=true;Print("BBP stopped: configuration, authorization or binding rejected. Review API setup before reattaching.");}
 else
 {next_attempt=GetTickCount64()+(ulong)retry_seconds*1000;retry_seconds=MathMin(retry_seconds*2,300);}
}
