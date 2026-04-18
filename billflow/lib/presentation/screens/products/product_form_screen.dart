import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/models/product_model.dart';
import '../../../providers/product_provider.dart';

class ProductFormScreen extends ConsumerStatefulWidget {
  final ProductModel? product;
  const ProductFormScreen({super.key, this.product});

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _barcodeCtrl;
  late final TextEditingController _priceCtrl;
  late final TextEditingController _costCtrl;
  late final TextEditingController _categoryCtrl;
  late final TextEditingController _taxCtrl;
  late final TextEditingController _stockCtrl;
  bool _hasInventory = false;
  String _unitType = 'unit';
  bool _isSaving = false;

  bool get _isEdit => widget.product != null;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _nameCtrl = TextEditingController(text: p?.name ?? '');
    _barcodeCtrl = TextEditingController(text: p?.barcode ?? '');
    _priceCtrl =
        TextEditingController(text: p != null ? p.price.toString() : '');
    _costCtrl =
        TextEditingController(text: p != null ? p.costPrice.toString() : '');
    _categoryCtrl = TextEditingController(text: p?.category ?? '');
    _taxCtrl = TextEditingController(
        text: p != null ? p.taxRate.toString() : '0');
    _stockCtrl =
        TextEditingController(text: p != null ? p.stockQuantity.toString() : '0');
    _hasInventory = p?.hasInventory ?? false;
    _unitType = p?.unitType ?? 'unit';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _barcodeCtrl.dispose();
    _priceCtrl.dispose();
    _costCtrl.dispose();
    _categoryCtrl.dispose();
    _taxCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final data = {
      'name': _nameCtrl.text.trim(),
      if (_barcodeCtrl.text.isNotEmpty) 'barcode': _barcodeCtrl.text.trim(),
      'price': double.tryParse(_priceCtrl.text) ?? 0,
      'cost_price': double.tryParse(_costCtrl.text) ?? 0,
      if (_categoryCtrl.text.isNotEmpty) 'category': _categoryCtrl.text.trim(),
      'tax_rate': double.tryParse(_taxCtrl.text) ?? 0,
      'has_inventory': _hasInventory,
      'unit_type': _unitType,
      if (_hasInventory)
        'stock_quantity': double.tryParse(_stockCtrl.text) ?? 0,
    };

    try {
      if (_isEdit) {
        await ref
            .read(productsProvider.notifier)
            .updateProduct(widget.product!.id, data);
      } else {
        await ref.read(productsProvider.notifier).createProduct(data);
      }
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Product' : 'Add Product'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Product Name *',
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Name is required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _barcodeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Barcode (optional)',
                  prefixIcon: Icon(Icons.barcode_reader),
                ),
              ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Selling Price *',
                      prefixText: 'RM ',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if (double.tryParse(v) == null) return 'Invalid';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _costCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Cost Price',
                      prefixText: 'RM ',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: _categoryCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Category',
                      prefixIcon: Icon(Icons.label_outline),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _taxCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Tax Rate',
                      suffixText: '%',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _unitType,
                decoration: const InputDecoration(
                  labelText: 'Unit Type',
                  prefixIcon: Icon(Icons.scale_outlined),
                ),
                items: const [
                  DropdownMenuItem(value: 'unit', child: Text('Unit')),
                  DropdownMenuItem(value: 'kg', child: Text('Kilogram (kg)')),
                ],
                onChanged: (v) => setState(() => _unitType = v!),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Track Inventory'),
                subtitle: const Text('Enable stock quantity tracking'),
                value: _hasInventory,
                onChanged: (v) => setState(() => _hasInventory = v),
              ),
              if (_hasInventory) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _stockCtrl,
                  decoration: InputDecoration(
                    labelText: _unitType == 'kg' ? 'Stock (kg)' : 'Stock Quantity',
                    prefixIcon: Icon(_unitType == 'kg'
                        ? Icons.scale_outlined
                        : Icons.warehouse_outlined),
                    suffixText: _unitType == 'kg' ? 'kg' : null,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                ),
              ],
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _isSaving ? null : _save,
                icon: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_outlined),
                label: Text(_isSaving
                    ? 'Saving...'
                    : (_isEdit ? 'Update Product' : 'Save Product')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
