import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/enums/app_enums.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/user_model.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/storage_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/ndfa_api_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/tracking_service.dart';
class TrackingStorage extends StorageService {
 final values=<String,dynamic>{};String uid='E';
 @override bool get isLoggedIn=>true;
 @override UserModel? getUser()=>UserModel(id:uid,name:uid,mobile:'9000000000',employeeId:uid,branch:'QA',role:UserRole.fieldOfficer,token:'fixture');
 @override List<Map<String,dynamic>> readList(String key)=>((values[key]??[]) as List).map((e)=>Map<String,dynamic>.from(e)).toList();
 @override Future<void> writeListDurable(String key,List<Map<String,dynamic>> items)async{values[key]=jsonDecode(jsonEncode(items));}
}
class TrackingApi extends NdfaApiService {
 bool fail=true;int sent=0;
 @override Future<Map<String,dynamic>> syncRoutePoints(List<Map<String,dynamic>> points)async{sent++;if(fail)throw Exception('Connection unavailable');return {'onDuty':true,'totalKm':0,'routePoints':[]};}
}
void main(){
 tearDown(()=>Get.reset());
 test('queued GPS retries without requiring a new location and stays employee scoped',()async{
  final storage=TrackingStorage(),api=TrackingApi();Get.put<StorageService>(storage);Get.put<NdfaApiService>(api);
  final service=TrackingService();
  final point={'lat':26.7,'lng':83.3,'accuracy':8,'recordedAt':'2026-10-27T04:30:00Z'};
  await storage.writeListDurable('pending_track_fixes_E',[point]);
  await service.retryPendingUploads();expect(storage.readList('pending_track_fixes_E'),hasLength(1));
  storage.uid='OTHER';await service.retryPendingUploads();expect(api.sent,1);
  storage.uid='E';api.fail=false;await service.retryPendingUploads();expect(api.sent,2);expect(storage.readList('pending_track_fixes_E'),isEmpty);expect(service.lastUploadAt.value,isNotNull);
 });
}
