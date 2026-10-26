import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/services/api_service.dart';
import '../utils/api_errors.dart';

class MySalarySlips extends StatefulWidget {
  const MySalarySlips({super.key});
  @override
  State<MySalarySlips> createState() => _MySalarySlipsState();
}

class _MySalarySlipsState extends State<MySalarySlips> {
  List<dynamic> slips = [];
  String? error;
  bool busy = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await Get.find<ApiService>().get('/payslips/mine');
      if (mounted)
        setState(() {
          slips = r.data['data'];
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('My salary slips')),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (busy) const LinearProgressIndicator(),
            if (error != null) Text(error!),
            if (!busy && slips.isEmpty)
              const Text('No salary slips released yet.'),
            ...slips.map((s) => Card(
                    child: ExpansionTile(
                        title: Text('${s['month']} · ₹${s['netPay']}'),
                        subtitle: Text(s['salaryReleasedAt'] != null
                            ? 'Salary payment recorded'
                            : 'Slip released · payment pending'),
                        children: [
                      ListTile(
                          title: Text(s['employeeName']),
                          subtitle:
                              Text('${s['employeeNo']} · ${s['companyName']}')),
                      ...((s['earnings'] as Map?) ?? {}).entries.map((e) =>
                          ListTile(
                              title: Text('${e.key}'),
                              trailing: Text('₹${e.value}'))),
                      ...((s['deductions'] as Map?) ?? {}).entries.map((e) =>
                          ListTile(
                              title: Text('${e.key} deduction'),
                              trailing: Text('₹${e.value}'))),
                      ListTile(
                          title: const Text('Net pay'),
                          trailing: Text('₹${s['netPay']}')),
                      const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                              'Digitally generated salary slip. No signature required.')),
                    ]))),
          ])));
}
