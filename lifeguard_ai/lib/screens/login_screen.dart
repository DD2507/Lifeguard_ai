import 'package:flutter/material.dart';

import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController usernameController =
      TextEditingController();

  final TextEditingController passwordController =
      TextEditingController();

  bool obscurePassword = true;
  String errorMessage = '';

  void login() {
    final username = usernameController.text.trim();
    final password = passwordController.text;

    if (username == 'admin' && password == 'admin123') {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const HomeScreen(),
        ),
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
      backgroundColor: const Color(0xFF001A21),
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
                    color: const Color(0xFF12353B),
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(
                      color: const Color(0xFF14606A),
                    ),
                  ),
                  child: const Icon(
                    Icons.favorite,
                    color: Color(0xFF20C8C8),
                    size: 48,
                  ),
                ),

                const SizedBox(height: 25),

                const Text(
                  'LifeGuard AI',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 7),

                const Text(
                  'Patient Care Intelligence',
                  style: TextStyle(
                    color: Color(0xFF8497A3),
                    fontSize: 14,
                  ),
                ),

                const SizedBox(height: 40),

                // Login Card
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141E2D),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFF263747),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [

                      const Text(
                        'Welcome Back',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 6),

                      const Text(
                        'Sign in to access the patient monitoring dashboard.',
                        style: TextStyle(
                          color: Color(0xFF8294A1),
                          fontSize: 12,
                        ),
                      ),

                      const SizedBox(height: 25),

                      const Text(
                        'Username',
                        style: TextStyle(
                          color: Color(0xFFB8C5CA),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 8),

                      TextField(
                        controller: usernameController,
                        style: const TextStyle(
                          color: Colors.white,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Enter username',
                          hintStyle: const TextStyle(
                            color: Color(0xFF718692),
                          ),
                          prefixIcon: const Icon(
                            Icons.person_outline,
                            color: Color(0xFF20C8C8),
                          ),
                          filled: true,
                          fillColor: const Color(0xFF101A27),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),

                      const SizedBox(height: 18),

                      const Text(
                        'Password',
                        style: TextStyle(
                          color: Color(0xFFB8C5CA),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 8),

                      TextField(
                        controller: passwordController,
                        obscureText: obscurePassword,
                        style: const TextStyle(
                          color: Colors.white,
                        ),
                        onSubmitted: (_) => login(),
                        decoration: InputDecoration(
                          hintText: 'Enter password',
                          hintStyle: const TextStyle(
                            color: Color(0xFF718692),
                          ),
                          prefixIcon: const Icon(
                            Icons.lock_outline,
                            color: Color(0xFF20C8C8),
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
                              color: const Color(0xFF718692),
                            ),
                          ),
                          filled: true,
                          fillColor: const Color(0xFF101A27),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),

                      if (errorMessage.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          errorMessage,
                          style: const TextStyle(
                            color: Color(0xFFFF6575),
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
                            backgroundColor:
                                const Color(0xFF20C8C8),
                            foregroundColor:
                                const Color(0xFF001A21),
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(12),
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
                  style: TextStyle(
                    color: Color(0xFF526570),
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}