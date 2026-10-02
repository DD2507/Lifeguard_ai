import 'package:flutter/material.dart';

import '../app_theme.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController usernameController = TextEditingController();

  final TextEditingController passwordController = TextEditingController();

  bool obscurePassword = true;
  String errorMessage = '';

  void login() {
    final username = usernameController.text.trim();
    final password = passwordController.text;

    if (username == 'admin' && password == 'admin123') {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } else {
      setState(() {
        errorMessage = 'Invalid username or password';
      });
    }
  }

  @override
  void dispose() {
    usernameController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LifeGuardColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo / Icon
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: LifeGuardColors.lime,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: LifeGuardColors.ink),
                  ),
                  child: const Icon(
                    Icons.favorite,
                    color: LifeGuardColors.ink,
                    size: 48,
                  ),
                ),

                const SizedBox(height: 25),

                const Text(
                  'LifeGuard AI',
                  style: TextStyle(
                    color: LifeGuardColors.ink,
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 7),

                const Text(
                  'Patient Care Intelligence',
                  style: TextStyle(color: LifeGuardColors.muted, fontSize: 14),
                ),

                const SizedBox(height: 40),

                // Login Card
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: LifeGuardColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: LifeGuardColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Welcome Back',
                        style: TextStyle(
                          color: LifeGuardColors.ink,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 6),

                      const Text(
                        'Sign in to access the patient monitoring dashboard.',
                        style: TextStyle(
                          color: LifeGuardColors.muted,
                          fontSize: 12,
                        ),
                      ),

                      const SizedBox(height: 25),

                      const Text(
                        'Username',
                        style: TextStyle(
                          color: LifeGuardColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 8),

                      TextField(
                        controller: usernameController,
                        style: const TextStyle(color: LifeGuardColors.ink),
                        decoration: InputDecoration(
                          hintText: 'Enter username',
                          hintStyle: const TextStyle(
                            color: LifeGuardColors.muted,
                          ),
                          prefixIcon: const Icon(
                            Icons.person_outline,
                            color: LifeGuardColors.emerald,
                          ),
                          filled: true,
                          fillColor: LifeGuardColors.surfaceMuted,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: LifeGuardColors.border,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 18),

                      const Text(
                        'Password',
                        style: TextStyle(
                          color: LifeGuardColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 8),

                      TextField(
                        controller: passwordController,
                        obscureText: obscurePassword,
                        style: const TextStyle(color: LifeGuardColors.ink),
                        onSubmitted: (_) => login(),
                        decoration: InputDecoration(
                          hintText: 'Enter password',
                          hintStyle: const TextStyle(
                            color: LifeGuardColors.muted,
                          ),
                          prefixIcon: const Icon(
                            Icons.lock_outline,
                            color: LifeGuardColors.emerald,
                          ),
                          suffixIcon: IconButton(
                            onPressed: () {
                              setState(() {
                                obscurePassword = !obscurePassword;
                              });
                            },
                            icon: Icon(
                              obscurePassword
                                  ? Icons.visibility_off
                                  : Icons.visibility,
                              color: LifeGuardColors.muted,
                            ),
                          ),
                          filled: true,
                          fillColor: LifeGuardColors.surfaceMuted,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: LifeGuardColors.border,
                            ),
                          ),
                        ),
                      ),

                      if (errorMessage.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          errorMessage,
                          style: const TextStyle(
                            color: LifeGuardColors.rose,
                            fontSize: 12,
                          ),
                        ),
                      ],

                      const SizedBox(height: 25),

                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: login,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: LifeGuardColors.lime,
                            foregroundColor: LifeGuardColors.ink,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: const Text(
                            'LOGIN',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 25),

                const Text(
                  'LifeGuard AI • Secure Patient Monitoring',
                  style: TextStyle(color: LifeGuardColors.muted, fontSize: 10),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
