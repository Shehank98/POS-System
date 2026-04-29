import 'package:flutter/material.dart';

class QuantityStepper extends StatelessWidget {
  final double quantity;
  final ValueChanged<double> onChanged;
  final double min;
  final double max;
  final double step;

  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
    this.min = 1.0,
    this.max = 999.0,
    this.step = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepButton(
          icon: Icons.remove,
          onTap: quantity > min
              ? () => onChanged((quantity - step).clamp(min, max))
              : null,
        ),
        Container(
          width: 44,
          alignment: Alignment.center,
          child: Text(
            quantity == quantity.floorToDouble()
                ? quantity.toInt().toString()
                : quantity.toStringAsFixed(1),
            style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: cs.onSurface),
          ),
        ),
        _StepButton(
          icon: Icons.add,
          onTap: quantity < max
              ? () => onChanged((quantity + step).clamp(min, max))
              : null,
          primary: true,
        ),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool primary;

  const _StepButton(
      {required this.icon, this.onTap, this.primary = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: onTap == null
              ? cs.surfaceContainerHighest.withValues(alpha: 0.4)
              : primary
                  ? cs.primary
                  : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 18,
          color: onTap == null
              ? cs.onSurface.withValues(alpha: 0.3)
              : primary
                  ? cs.onPrimary
                  : cs.onSurfaceVariant,
        ),
      ),
    );
  }
}
