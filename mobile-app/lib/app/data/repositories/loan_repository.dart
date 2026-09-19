import 'package:get/get.dart';
import '../models/loan_model.dart';
import '../models/enums/app_enums.dart';
import '../services/ndfa_api_service.dart';

/// Legacy — loan UI removed from app; kept for analyzer compatibility only.
class LoanRepository {
  NdfaApiService get _api => Get.find<NdfaApiService>();

  Future<LoanModel> submitLoan(LoanModel loan) => _api.submitLoan(loan);

  Future<LoanModel> saveVerification(LoanModel loan, {bool submit = false}) =>
      _api.saveVerification(loan, submit: submit);

  Future<List<LoanModel>> getLoansForApproval({LoanStatus? status}) =>
      _api.getLoansForApproval(status: status);

  Future<LoanModel> processApproval(String loanId, ApprovalAction action) =>
      _api.processApproval(loanId, action);
}
