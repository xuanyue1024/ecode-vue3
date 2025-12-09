import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const username = ref('游客')
  const userRole = ref('')
  const name = ref('')
  const profilePicture = ref('')
  
  const exampleCode = {
    'java': `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, ecode");
  }
}`,
    'cpp': `#include <iostream>

int main() {
  std::cout << "hello, ecode" << std::endl;
  return 0;
}`,
    'python3': `import os
import sys

# 请在此输入您的代码
print('hello,ecode')`,
    'swift': `import Swift

print("hello, ecode")`,
    'rust': `fn main() {
  println!("hello, ecode");
}`,
    'php': `<?php
echo 'hello, ecode';
?>`,
    'nodejs': `console.log('hello, ecode');`,
    'kotlin': `fun main() {
  println("hello, ecode")
}`,
    'go': `package main
  
import "fmt"
  
func main() {
  fmt.Println("hello, ecode")
}`,
    '.net': `using System;
  
class Program {
  static void Main() {
    Console.WriteLine("hello, ecode");
  }
}`
  }

  function setUserName(newName: string) {
    username.value = newName
  }

  function setUserRole(newRole: string) {
    userRole.value = newRole
  }

  function setName(newName: string) {
    name.value = newName
  }

  function setProfilePicture(newUrl: string) {
    profilePicture.value = newUrl
  }

  function logout() {
    username.value = '游客'
    userRole.value = ''
    name.value = ''
    profilePicture.value = ''
    localStorage.removeItem('token')
  }

  function getExampleCode(language: keyof typeof exampleCode) {
    return exampleCode[language] || ''
  }

  return {
    username,
    userRole,
    name,
    profilePicture,
    exampleCode,
    setUserName,
    setUserRole,
    setName,
    setProfilePicture,
    logout,
    getExampleCode
  }
}, {
  persist: true
})
